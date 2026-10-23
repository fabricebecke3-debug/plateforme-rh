-- =====================================================================
-- Documents par entreprise : cours, codes, conventions collectives, procédures
-- À exécuter une fois dans Supabase -> SQL Editor (idempotent : peut être relancé).
-- Lecture : tout membre de l'entreprise (lecteur, éditeur ou admin), sauf niveau « none ».
-- Ajout / modification / suppression : UNIQUEMENT le propriétaire ou l'administrateur de l'entreprise.
-- =====================================================================

create table if not exists public.formation_documents (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.entreprises(id) on delete cascade,
  titre text not null,
  type text,                    -- format du fichier (docx, pdf, md, txt, txt pour un texte publié)
  nom_fichier text,
  chemin text,                  -- chemin dans le bucket formation-docs : <entreprise_id>/<fichier> (vide si texte publié)
  texte_extrait text,
  cree_par uuid default auth.uid(),
  cree_le timestamptz default now()
);

-- Catégorie du document (colonne distincte du format de fichier)
alter table public.formation_documents
  add column if not exists categorie text not null default 'autre';
alter table public.formation_documents drop constraint if exists formation_documents_categorie_check;
alter table public.formation_documents add constraint formation_documents_categorie_check
  check (categorie in ('convention','code','cours','procedure','autre'));

create index if not exists formation_documents_entreprise_idx on public.formation_documents (entreprise_id, categorie);

alter table public.formation_documents enable row level security;

drop policy if exists fd_select on public.formation_documents;
drop policy if exists fd_insert on public.formation_documents;
drop policy if exists fd_update on public.formation_documents;
drop policy if exists fd_delete on public.formation_documents;

-- Lecture : tout membre (terh_can_mod, niveau « read »)
create policy fd_select on public.formation_documents for select to authenticated
  using (public.terh_can_mod(entreprise_id, 'documents', 'read'));
-- Écriture : propriétaire ou administrateur de l'entreprise uniquement (terh_admin)
create policy fd_insert on public.formation_documents for insert to authenticated
  with check (public.terh_admin(entreprise_id));
create policy fd_update on public.formation_documents for update to authenticated
  using (public.terh_admin(entreprise_id))
  with check (public.terh_admin(entreprise_id));
create policy fd_delete on public.formation_documents for delete to authenticated
  using (public.terh_admin(entreprise_id));

-- Bucket privé « formation-docs » : fichiers rangés par entreprise (premier niveau du chemin)
insert into storage.buckets (id, name, public) values ('formation-docs', 'formation-docs', false)
  on conflict (id) do nothing;

drop policy if exists fdocs_select on storage.objects;
drop policy if exists fdocs_insert on storage.objects;
drop policy if exists fdocs_delete on storage.objects;

create policy fdocs_select on storage.objects for select to authenticated
  using (bucket_id = 'formation-docs'
         and public.terh_can_mod(public.safe_uuid((storage.foldername(name))[1]), 'documents', 'read'));
create policy fdocs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'formation-docs'
         and public.terh_admin(public.safe_uuid((storage.foldername(name))[1])));
create policy fdocs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'formation-docs'
         and public.terh_admin(public.safe_uuid((storage.foldername(name))[1])));
