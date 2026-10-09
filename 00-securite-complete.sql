-- =====================================================================
-- 00 — SÉCURITÉ COMPLÈTE DE LA PLATEFORME RH (version consolidée)
-- Regroupe toutes les règles d'accès écrites pendant le projet.
-- À exécuter dans Supabase > SQL Editor, de préférence sur un projet de test d'abord.
-- Ré-exécutable : chaque règle est supprimée puis recréée.
-- Dépendance : la fonction public.is_platform_owner() doit exister.
-- =====================================================================

-- ---------- 1) FONCTIONS COMMUNES ----------
create or replace function public.terh_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_owner();
$$;

-- Administrateur d'une société, directement ou par héritage d'une société mère
create or replace function public.terh_admin(eid uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if public.terh_is_owner() then return true; end if;
  if eid is null then return false; end if;
  if exists (select 1 from public.user_entreprises ue
             where ue.user_id = auth.uid() and ue.entreprise_id = eid and ue.role = 'admin') then
    return true;
  end if;
  return exists (
    with recursive anc(oid, parent, d) as (
      select e.id, e.groupe_id, 0 from public.entreprises e where e.id = eid
      union all
      select e.id, e.groupe_id, a.d + 1 from public.entreprises e join anc a on e.id = a.parent where a.d < 20)
    select 1 from public.user_entreprises ue join anc on anc.oid = ue.entreprise_id
     where ue.user_id = auth.uid() and anc.d > 0 and ue.role = 'admin');
end $$;

-- Droits sur un module : lecture, écriture, suppression (rôle + niveau du module + héritage)
create or replace function public.terh_can_mod(eid uuid, mod text, need text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r text; p jsonb; lvl text; direct boolean;
begin
  if public.terh_is_owner() then return true; end if;
  if eid is null then return false; end if;
  select ue.role, ue.perms into r, p from public.user_entreprises ue
   where ue.user_id = auth.uid() and ue.entreprise_id = eid;
  direct := found;
  if not direct then
    with recursive anc(oid, parent, d) as (
      select e.id, e.groupe_id, 0 from public.entreprises e where e.id = eid
      union all
      select e.id, e.groupe_id, a.d + 1 from public.entreprises e join anc a on e.id = a.parent where a.d < 20)
    select case when ue.role = 'admin' then 'admin' else 'lecteur' end, ue.perms into r, p
      from public.user_entreprises ue join anc on anc.oid = ue.entreprise_id
     where ue.user_id = auth.uid() and anc.d > 0
       and (ue.role = 'admin' or coalesce((ue.perms->>'dg')::boolean, false))
     order by anc.d limit 1;
    if not found then return false; end if;
  end if;
  lvl := coalesce(p->'lvl'->>mod, '');
  if lvl = 'none' then return false; end if;
  if need = 'read'   then return r in ('lecteur','editeur','admin'); end if;
  if need = 'insert' then return r in ('editeur','admin') and lvl in ('','add','edit'); end if;
  if need = 'update' then return r in ('editeur','admin') and lvl in ('','edit'); end if;
  if need = 'delete' then return r in ('editeur','admin') and lvl in ('','edit')
                          and not coalesce((p->>'nodelete')::boolean, false); end if;
  return false;
end $$;

-- Convertit un dossier en identifiant, sans erreur
create or replace function public.safe_uuid(t text) returns uuid
language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

-- ---------- 2) ACCÈS AUX SOCIÉTÉS ET AUX COMPTES ----------
alter table public.entreprises enable row level security;
drop policy if exists p_ent_select on public.entreprises;
create policy p_ent_select on public.entreprises for select to authenticated
  using (public.terh_can_mod(id, null, 'read'));
drop policy if exists p_ent_insert on public.entreprises;
create policy p_ent_insert on public.entreprises for insert to authenticated
  with check (public.terh_is_owner() or public.terh_admin(null) or exists (
    select 1 from public.user_entreprises ue where ue.user_id = auth.uid() and ue.role = 'admin'));
drop policy if exists p_ent_update on public.entreprises;
create policy p_ent_update on public.entreprises for update to authenticated
  using (public.terh_is_owner() or public.terh_admin(id))
  with check (public.terh_is_owner() or public.terh_admin(id));
drop policy if exists p_ent_delete on public.entreprises;
create policy p_ent_delete on public.entreprises for delete to authenticated
  using (public.terh_is_owner());

alter table public.user_entreprises enable row level security;
drop policy if exists p_ue_select on public.user_entreprises;
create policy p_ue_select on public.user_entreprises for select to authenticated
  using (public.terh_is_owner() or user_id = auth.uid() or public.terh_admin(entreprise_id));
drop policy if exists p_ue_write on public.user_entreprises;
create policy p_ue_write on public.user_entreprises for all to authenticated
  using (public.terh_is_owner() or public.terh_admin(entreprise_id))
  with check (public.terh_is_owner() or public.terh_admin(entreprise_id));

alter table public.user_roles enable row level security;
drop policy if exists p_ur_select on public.user_roles;
create policy p_ur_select on public.user_roles for select to authenticated
  using (
    public.terh_is_owner() or user_id = auth.uid()
    or exists (
      select 1 from public.user_entreprises me
      join public.user_entreprises them on them.entreprise_id = me.entreprise_id
      where me.user_id = auth.uid() and me.role = 'admin' and them.user_id = user_roles.user_id));
drop policy if exists p_ur_write on public.user_roles;
create policy p_ur_write on public.user_roles for all to authenticated
  using (public.terh_is_owner()) with check (public.terh_is_owner());

alter table public.user_profiles enable row level security;
drop policy if exists p_up_select on public.user_profiles;
create policy p_up_select on public.user_profiles for select to authenticated using (true);
drop policy if exists p_up_write on public.user_profiles;
create policy p_up_write on public.user_profiles for all to authenticated
  using (public.terh_is_owner() or user_id = auth.uid())
  with check (public.terh_is_owner() or user_id = auth.uid());

-- ---------- 3) MODULES MÉTIER (personnel, congés, paie, etc.) ----------
do $$
declare m record; pol record;
begin
  for m in select * from (values
    ('employes','personnel'), ('conges','conges'), ('absences','absences'), ('annonces','annonces'),
    ('certifications','certifications'), ('contacts','contacts'), ('evaluations','evaluations'),
    ('fiches_poste','fiches'), ('formations','formation'), ('materiel','materiel'),
    ('notes_service','notes'), ('paie','paie'), ('recrutement_offres','recrutement'),
    ('sms_queue','alertes'), ('sms_templates','alertes'), ('taches','taches')
  ) as t(tbl, md)
  loop
    if to_regclass('public.' || m.tbl) is null then continue; end if;
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = m.tbl loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, m.tbl);
    end loop;
    execute format('alter table public.%I enable row level security', m.tbl);
    execute format('create policy u_sel on public.%I for select to authenticated using (public.terh_can_mod(entreprise_id, %L, ''read''))', m.tbl, m.md);
    execute format('create policy u_ins on public.%I for insert to authenticated with check (public.terh_can_mod(entreprise_id, %L, ''insert''))', m.tbl, m.md);
    execute format('create policy u_upd on public.%I for update to authenticated using (public.terh_can_mod(entreprise_id, %L, ''update'')) with check (public.terh_can_mod(entreprise_id, %L, ''update''))', m.tbl, m.md, m.md);
    execute format('create policy u_del on public.%I for delete to authenticated using (public.terh_can_mod(entreprise_id, %L, ''delete''))', m.tbl, m.md);
  end loop;
end $$;

-- Inscriptions aux formations et candidatures : droits hérités de la table parente
alter table public.formation_inscriptions enable row level security;
drop policy if exists formation_inscriptions_select on public.formation_inscriptions;
drop policy if exists formation_inscriptions_write on public.formation_inscriptions;
drop policy if exists fi_sel on public.formation_inscriptions;
drop policy if exists fi_ins on public.formation_inscriptions;
drop policy if exists fi_upd on public.formation_inscriptions;
drop policy if exists fi_del on public.formation_inscriptions;
create policy fi_sel on public.formation_inscriptions for select to authenticated
  using (exists (select 1 from public.formations f where f.id = formation_id and public.terh_can_mod(f.entreprise_id, 'formation', 'read')));
create policy fi_ins on public.formation_inscriptions for insert to authenticated
  with check (exists (select 1 from public.formations f where f.id = formation_id and public.terh_can_mod(f.entreprise_id, 'formation', 'insert')));
create policy fi_upd on public.formation_inscriptions for update to authenticated
  using (exists (select 1 from public.formations f where f.id = formation_id and public.terh_can_mod(f.entreprise_id, 'formation', 'update')))
  with check (exists (select 1 from public.formations f where f.id = formation_id and public.terh_can_mod(f.entreprise_id, 'formation', 'update')));
create policy fi_del on public.formation_inscriptions for delete to authenticated
  using (exists (select 1 from public.formations f where f.id = formation_id and public.terh_can_mod(f.entreprise_id, 'formation', 'delete')));

alter table public.recrutement_candidatures enable row level security;
drop policy if exists recrutement_candidatures_select on public.recrutement_candidatures;
drop policy if exists recrutement_candidatures_write on public.recrutement_candidatures;
drop policy if exists rc_sel on public.recrutement_candidatures;
drop policy if exists rc_ins on public.recrutement_candidatures;
drop policy if exists rc_upd on public.recrutement_candidatures;
drop policy if exists rc_del on public.recrutement_candidatures;
create policy rc_sel on public.recrutement_candidatures for select to authenticated
  using (exists (select 1 from public.recrutement_offres o where o.id = offre_id and public.terh_can_mod(o.entreprise_id, 'recrutement', 'read')));
create policy rc_ins on public.recrutement_candidatures for insert to authenticated
  with check (exists (select 1 from public.recrutement_offres o where o.id = offre_id and public.terh_can_mod(o.entreprise_id, 'recrutement', 'insert')));
create policy rc_upd on public.recrutement_candidatures for update to authenticated
  using (exists (select 1 from public.recrutement_offres o where o.id = offre_id and public.terh_can_mod(o.entreprise_id, 'recrutement', 'update')))
  with check (exists (select 1 from public.recrutement_offres o where o.id = offre_id and public.terh_can_mod(o.entreprise_id, 'recrutement', 'update')));
create policy rc_del on public.recrutement_candidatures for delete to authenticated
  using (exists (select 1 from public.recrutement_offres o where o.id = offre_id and public.terh_can_mod(o.entreprise_id, 'recrutement', 'delete')));

-- ---------- 4) PARAMÈTRES (clés publiques, clés d'écriture des éditeurs) ----------
alter table public.parametres enable row level security;
drop policy if exists p_par_select on public.parametres;
drop policy if exists p_par_write on public.parametres;
create policy p_par_select on public.parametres for select to authenticated
  using (
    public.terh_admin(entreprise_id)
    or (cle = any(array['soc','lieu','tel','email','sig','fn','client','adresse','tpl_let','tpl_cert',
        'ent_service','ent_mere','ent_mere_adr','ent_mad_label','ent_mode','ent_mentions','dash',
        'alert_jours','contrats_hist','perso_extra','perso_cols','perso_show','essai_hist',
        'essai_decisions','sortie_checklist','cdd_seuils','types_contrat','profils_acces',
        'owner_json','web_json','ui_texts_json','signatures_json','recit_plateforme','assistant_style']::text[])
        and public.terh_can_mod(entreprise_id, null, 'read')));
create policy p_par_write on public.parametres for all to authenticated
  using (
    public.terh_admin(entreprise_id)
    or (cle = any(array['essai_hist','essai_decisions','sortie_checklist','perso_extra','contrats_hist']::text[])
        and public.terh_can_mod(entreprise_id, 'personnel', 'update')))
  with check (
    public.terh_admin(entreprise_id)
    or (cle = any(array['essai_hist','essai_decisions','sortie_checklist','perso_extra','contrats_hist']::text[])
        and public.terh_can_mod(entreprise_id, 'personnel', 'update')));

-- ---------- 5) JOURNAL D'AUDIT (ajout seul, lecture par propriétaire et admin de société) ----------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid, user_email text, entreprise_id uuid,
  table_name text not null, action text not null, row_id text,
  old_data jsonb, new_data jsonb
);
alter table public.audit_log enable row level security;
drop policy if exists al_sel on public.audit_log;
create policy al_sel on public.audit_log for select to authenticated
  using (public.terh_is_owner() or (entreprise_id is not null and public.terh_admin(entreprise_id)));
revoke update, delete, truncate on public.audit_log from anon, authenticated;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare co uuid; rid text; src jsonb;
begin
  if TG_OP = 'DELETE' then src := to_jsonb(OLD); else src := to_jsonb(NEW); end if;
  if TG_TABLE_NAME = 'entreprises' then co := (src->>'id')::uuid;
  else co := (src->>'entreprise_id')::uuid; end if;
  rid := src->>'id';
  insert into public.audit_log(user_id, user_email, entreprise_id, table_name, action, row_id, old_data, new_data)
  values (auth.uid(), lower(coalesce(auth.jwt()->>'email','')), co, TG_TABLE_NAME, TG_OP, rid,
          case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) end,
          case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) end);
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

do $$
declare t text;
begin
  foreach t in array array['employes','conges','entreprises','user_entreprises','user_roles','parametres',
    'absences','annonces','certifications','contacts','evaluations','fiches_poste','formations','materiel',
    'notes_service','paie','recrutement_offres','sms_templates','taches'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_%s on public.%I', t, t);
      execute format('create trigger audit_%s after insert or update or delete on public.%I
                      for each row execute function public.audit_row()', t, t);
    end if;
  end loop;
end $$;

-- ---------- 6) STOCKAGE : avatars (privés), contrats, signatures ----------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false)
  on conflict (id) do update set public = false;

drop policy if exists branding_avatar_insert on storage.objects;
drop policy if exists branding_avatar_update on storage.objects;
drop policy if exists branding_avatar_write on storage.objects;
drop policy if exists branding_logos_ecriture on storage.objects;

drop policy if exists av_select on storage.objects;
drop policy if exists av_insert on storage.objects;
drop policy if exists av_update on storage.objects;
drop policy if exists av_delete on storage.objects;
create policy av_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] = '6283a8a4-88e5-4006-ae21-0baa89d0ad96'
        and coalesce((storage.foldername(name))[2], '') <> 'source')));
create policy av_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy av_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy av_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Contrats : visibles seulement si un employé lié au fichier est accessible
create or replace function public.can_see_contrat(p text) returns boolean
language sql stable security definer set search_path = public, storage as $$
  select public.terh_is_owner()
  or exists (select 1 from public.employes e
             where e.contrat_url is not null and strpos(e.contrat_url, p) > 0
               and public.terh_can_mod(e.entreprise_id, 'personnel', 'read'));
$$;
drop policy if exists contrats_insert on storage.objects;
drop policy if exists contrats_update on storage.objects;
drop policy if exists contrats_delete on storage.objects;
drop policy if exists contrats_read on storage.objects;
drop policy if exists owner_all_contrats on storage.objects;
create policy contrats_read on storage.objects for select to authenticated
  using (bucket_id = 'contrats' and public.can_see_contrat(name));
create policy contrats_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'contrats' and (
    public.terh_is_owner()
    or exists (select 1 from public.user_entreprises ue where ue.user_id = auth.uid() and ue.role in ('admin','editeur'))));
create policy contrats_update on storage.objects for update to authenticated
  using (bucket_id = 'contrats' and (public.terh_is_owner() or exists (
    select 1 from public.employes e where e.contrat_url is not null and strpos(e.contrat_url, name) > 0
      and public.terh_can_mod(e.entreprise_id, 'personnel', 'update'))))
  with check (bucket_id = 'contrats');
create policy contrats_delete on storage.objects for delete to authenticated
  using (bucket_id = 'contrats' and (public.terh_is_owner() or exists (
    select 1 from public.employes e where e.contrat_url is not null and strpos(e.contrat_url, name) > 0
      and public.terh_can_mod(e.entreprise_id, 'personnel', 'delete'))));

-- Signatures : rangées par société (premier dossier = identifiant de la société)
drop policy if exists sg_sel on storage.objects;
drop policy if exists sg_ins on storage.objects;
drop policy if exists sg_upd on storage.objects;
drop policy if exists sg_del on storage.objects;
create policy sg_sel on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and (public.terh_is_owner()
    or public.terh_can_mod(public.safe_uuid((storage.foldername(name))[1]), null, 'read')));
create policy sg_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'signatures' and (public.terh_is_owner()
    or public.terh_admin(public.safe_uuid((storage.foldername(name))[1]))));
create policy sg_upd on storage.objects for update to authenticated
  using (bucket_id = 'signatures' and (public.terh_is_owner()
    or public.terh_admin(public.safe_uuid((storage.foldername(name))[1]))))
  with check (bucket_id = 'signatures' and (public.terh_is_owner()
    or public.terh_admin(public.safe_uuid((storage.foldername(name))[1]))));
create policy sg_del on storage.objects for delete to authenticated
  using (bucket_id = 'signatures' and (public.terh_is_owner()
    or public.terh_admin(public.safe_uuid((storage.foldername(name))[1]))));

-- ---------- 7) CONTRÔLE FINAL ----------
-- Tables sans protection (doit ne retourner aucune ligne) :
select c.relname as table_sans_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
order by c.relname;
