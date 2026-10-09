-- =====================================================================
-- COMPTES D'APPRENANTS ET PROGRESSION — à exécuter dans Supabase > SQL Editor
-- Réutilise les fonctions existantes : terh_is_owner(), terh_admin(eid).
-- =====================================================================

-- 1) Apprenants : une ligne par personne invitée à se former
create table if not exists public.formation_apprenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,                       -- renseigné quand la personne accepte l'invitation
  email text not null,
  nom text not null,
  entreprise_id uuid,                        -- société qui gère la formation
  statut text not null default 'invite' check (statut in ('invite','actif','suspendu')),
  cree_par uuid,
  cree_le timestamptz not null default now()
);
create unique index if not exists formation_apprenants_email_uq on public.formation_apprenants (lower(email));

-- 2) Progression : une ligne par apprenant et par module
create table if not exists public.formation_progres (
  id bigint generated always as identity primary key,
  apprenant_user_id uuid not null,
  module text not null,
  score numeric,
  termine boolean not null default false,
  mis_a_jour timestamptz not null default now(),
  unique (apprenant_user_id, module)
);

alter table public.formation_apprenants enable row level security;
alter table public.formation_progres enable row level security;

-- Apprenants : chacun voit sa propre fiche
drop policy if exists fa_self on public.formation_apprenants;
create policy fa_self on public.formation_apprenants for select to authenticated
  using (user_id = auth.uid());

-- Administrateurs de la société (et propriétaire) : gèrent leurs apprenants
drop policy if exists fa_admin on public.formation_apprenants;
create policy fa_admin on public.formation_apprenants for all to authenticated
  using (public.terh_is_owner() or (entreprise_id is not null and public.terh_admin(entreprise_id)))
  with check (public.terh_is_owner() or (entreprise_id is not null and public.terh_admin(entreprise_id)));

-- Progression : l'apprenant écrit et lit la sienne ; l'administrateur lit celle de sa société
drop policy if exists fp_self on public.formation_progres;
create policy fp_self on public.formation_progres for all to authenticated
  using (apprenant_user_id = auth.uid())
  with check (apprenant_user_id = auth.uid());

drop policy if exists fp_admin on public.formation_progres;
create policy fp_admin on public.formation_progres for select to authenticated
  using (public.terh_is_owner() or exists (
    select 1 from public.formation_apprenants a
    where a.user_id = formation_progres.apprenant_user_id
      and a.entreprise_id is not null and public.terh_admin(a.entreprise_id)));

-- Contrôle : nombre d'apprenants par société (à exécuter pour vérifier)
-- select entreprise_id, statut, count(*) from public.formation_apprenants group by 1,2;
