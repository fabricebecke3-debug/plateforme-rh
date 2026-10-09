-- =====================================================================
-- MAINTENANCE — Plateforme RH
-- À exécuter dans Supabase > SQL Editor. Réservé au propriétaire (contrôlé ci-dessous).
-- =====================================================================

-- 1) Durée de conservation du journal (en années). Modifiable ici, après validation juridique.
create table if not exists public.retention_config (
  id int primary key default 1,
  audit_years int not null default 5,
  updated_at timestamptz not null default now(),
  constraint one_row check (id = 1)
);
insert into public.retention_config (id, audit_years) values (1, 5) on conflict (id) do nothing;
alter table public.retention_config enable row level security;
drop policy if exists rc_owner on public.retention_config;
create policy rc_owner on public.retention_config for all to authenticated
  using (public.terh_is_owner()) with check (public.terh_is_owner());

-- 2) Purge du journal au-delà de la durée de conservation.
--    Dry-run par défaut : indique le nombre de lignes concernées sans rien supprimer.
create or replace function public.purge_audit(confirmer boolean default false)
returns table(lignes_concernees bigint, supprimees bigint)
language plpgsql security definer set search_path = public as $$
declare years int; cutoff timestamptz; n bigint; d bigint := 0;
begin
  if not public.terh_is_owner() then raise exception 'Réservé au propriétaire'; end if;
  select audit_years into years from public.retention_config where id = 1;
  cutoff := now() - make_interval(years => years);
  select count(*) into n from public.audit_log where created_at < cutoff;
  if confirmer then
    -- Le journal est « ajout seul » pour tout le monde ; seule cette fonction propriétaire peut purger
    delete from public.audit_log where created_at < cutoff;
    get diagnostics d = row_count;
  end if;
  return query select n, d;
end $$;

-- Utilisation :
--   select * from public.purge_audit(false);  -- voir combien de lignes seraient supprimées
--   select * from public.purge_audit(true);   -- supprimer réellement

-- 3) Contrôle des clés publiques : aucune donnée personnelle ne doit s'y trouver.
--    Ce contrôle affiche la taille des valeurs publiées : à examiner si elle est inhabituelle.
select cle, length(valeur::text) as taille_caracteres
from public.parametres
where cle in ('owner_json','web_json','recit_plateforme','assistant_style')
order by cle;
