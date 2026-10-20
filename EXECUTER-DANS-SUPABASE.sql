-- ===========================================================
-- TERH — SCRIPTS SQL À EXÉCUTER DANS L'ORDRE (Supabase > SQL Editor)
-- Prérequis : sql/00-securite-complete.sql déjà exécuté.
-- Tester d'abord sur un projet de test.
-- ===========================================================

-- ####### date-entree.sql #######
-- Date d'entrée dans l'entreprise (base de l'ancienneté).
-- Distincte de « debut » (début du contrat en cours, qui repart à chaque renouvellement de CDD).
-- À exécuter dans Supabase → SQL Editor AVANT de remplacer le site.
alter table public.employes add column if not exists date_entree date;
comment on column public.employes.date_entree is 'Date d''entrée dans l''entreprise : sert au calcul de l''ancienneté. Ne pas confondre avec debut (début du contrat en cours).';
-- Pas de remplissage automatique : la date d'entrée réelle doit être saisie fiche par fiche.
-- Si la vue employes_lecteur existe, la recréer pour y inclure date_entree (voir sql/00-securite-complete.sql).

-- ####### lieu-travail.sql #######
-- Lieu de travail de chaque salarié (ville du poste), distinct du siège de la société.
-- À exécuter dans Supabase → SQL Editor AVANT de remplacer le site.
alter table public.employes add column if not exists lieu_travail text;
comment on column public.employes.lieu_travail is 'Ville où le salarié travaille (peut différer du siège de la société ou de la société mère).';

-- ####### creation-societe-proprietaire.sql #######
-- Création de sociétés réservée au propriétaire (Super Owner).
-- Remplace la règle qui autorisait tout administrateur à créer une société.
-- À exécuter dans Supabase → SQL Editor, après sql/00-securite-complete.sql.
drop policy if exists p_ent_insert on public.entreprises;
create policy p_ent_insert on public.entreprises for insert to authenticated
  with check (public.terh_is_owner());

-- ####### paie-parametres.sql #######
-- ============================================================
-- PARAMÈTRES DE PAIE : taux et rubriques, avec date d'effet et historique.
-- Règle : aucune ligne n'est jamais modifiée ni supprimée pour changer une valeur.
-- Pour changer un taux : on clôt l'ancienne version (date_fin) et on crée une nouvelle (date_effet).
-- À exécuter dans Supabase → SQL Editor, après sql/00-securite-complete.sql.
-- ============================================================

create table if not exists public.paie_taux (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.entreprises(id) on delete cascade,
  code          text not null,          -- ex. cnps_sal, cnps_pat, cac, cfc_sal
  libelle       text not null,
  valeur        numeric(12,4) not null,
  date_effet    date not null,
  date_fin      date,                   -- null = en vigueur
  cree_par      uuid default auth.uid(),
  cree_le       timestamptz default now(),
  constraint paie_taux_dates check (date_fin is null or date_fin > date_effet)
);
create index if not exists paie_taux_idx on public.paie_taux (entreprise_id, code, date_effet);

create table if not exists public.paie_rubriques (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.entreprises(id) on delete cascade,
  code          text not null,          -- ex. 1110, 1430, 9015
  libelle       text not null,
  type          text not null check (type in ('gain','retenue')),
  taux_defaut   numeric(8,2),           -- ex. 120 pour une heure supplémentaire à 120 %
  imposable     boolean not null default true,
  transport     boolean not null default false,  -- déduite de la base CNPS (TRANSC)
  logement      boolean not null default false,  -- logement consommé (IL2)
  heures_sup    boolean not null default false,  -- base horaire = salaire de base ÷ 173,33
  date_effet    date not null,
  date_fin      date,
  cree_par      uuid default auth.uid(),
  cree_le       timestamptz default now(),
  constraint paie_rub_dates check (date_fin is null or date_fin > date_effet)
);
create index if not exists paie_rub_idx on public.paie_rubriques (entreprise_id, code, date_effet);

-- Sécurité : lecture pour les profils qui voient le module Paie ; écriture pour les administrateurs seulement
alter table public.paie_taux enable row level security;
alter table public.paie_rubriques enable row level security;

drop policy if exists paie_taux_select on public.paie_taux;
drop policy if exists paie_taux_insert on public.paie_taux;
drop policy if exists paie_taux_update on public.paie_taux;
create policy paie_taux_select on public.paie_taux for select to authenticated
  using (public.terh_admin(entreprise_id) or public.terh_can_mod(entreprise_id, 'paie', 'read'));
create policy paie_taux_insert on public.paie_taux for insert to authenticated
  with check (public.terh_admin(entreprise_id));
-- pas de politique de suppression : l'historique est conservé
create policy paie_taux_update on public.paie_taux for update to authenticated
  using (public.terh_admin(entreprise_id)) with check (public.terh_admin(entreprise_id));

drop policy if exists paie_rub_select on public.paie_rubriques;
drop policy if exists paie_rub_insert on public.paie_rubriques;
drop policy if exists paie_rub_update on public.paie_rubriques;
create policy paie_rub_select on public.paie_rubriques for select to authenticated
  using (public.terh_admin(entreprise_id) or public.terh_can_mod(entreprise_id, 'paie', 'read'));
create policy paie_rub_insert on public.paie_rubriques for insert to authenticated
  with check (public.terh_admin(entreprise_id));
create policy paie_rub_update on public.paie_rubriques for update to authenticated
  using (public.terh_admin(entreprise_id)) with check (public.terh_admin(entreprise_id));

-- Journal d'audit : mêmes triggers que les autres tables sensibles
do $$
declare t text;
begin
  foreach t in array array['paie_taux','paie_rubriques'] loop
    execute format('drop trigger if exists audit_%s on public.%I', t, t);
    execute format('create trigger audit_%s after insert or update or delete on public.%I
                    for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- Valeurs de départ (version 1 du cas CIMPOR, à vérifier) : cotisations CNPS, CFC, CAC
-- Insérées seulement si la société n'a encore aucun taux.
-- Les dates d'effet sont à ajuster à la date de mise en service.
-- insert into public.paie_taux (entreprise_id, code, libelle, valeur, date_effet)
--   select e.id, t.code, t.libelle, t.valeur, date '2026-01-01'
--   from public.entreprises e
--   cross join (values
--     ('cnps_sal','Pension salariale CNPS (%)',4.2),
--     ('cnps_pat','Pension patronale CNPS (%)',4.2),
--     ('at_pat','Accidents du travail patronal (%)',2.5),
--     ('pf_pat','Prestations familiales patronal (%)',7),
--     ('fne_pat','FNE patronal (%)',1),
--     ('cfc_sal','Crédit foncier salarial (%)',1),
--     ('cfc_pat','Crédit foncier patronal (%)',1.5),
--     ('cac','CAC sur IRPP (%)',10)
--   ) as t(code, libelle, valeur)
--   where not exists (select 1 from public.paie_taux x where x.entreprise_id = e.id);

-- ============================================================
-- FONCTIONS DE CHANGEMENT DE VERSION (une seule transaction : tout ou rien)
-- ============================================================

-- Nouvelle version d'un taux : ferme la version en vigueur, crée la nouvelle
create or replace function public.paie_nouvelle_version_taux(
  p_entreprise uuid, p_code text, p_libelle text, p_valeur numeric, p_date date)
returns uuid language plpgsql security invoker as $$
declare nid uuid;
begin
  if not public.terh_admin(p_entreprise) then raise exception 'Droit insuffisant pour modifier les taux'; end if;
  if p_code is null or p_libelle is null or p_valeur is null or p_date is null then
    raise exception 'Code, libellé, valeur et date d''effet sont obligatoires';
  end if;
  if exists (select 1 from public.paie_taux
              where entreprise_id is not distinct from p_entreprise and code = p_code
                and date_fin is null and date_effet >= p_date) then
    raise exception 'Une version existe déjà à cette date ou après : choisissez une date postérieure';
  end if;
  update public.paie_taux set date_fin = p_date
   where entreprise_id is not distinct from p_entreprise and code = p_code and date_fin is null;
  insert into public.paie_taux (entreprise_id, code, libelle, valeur, date_effet)
    values (p_entreprise, p_code, p_libelle, p_valeur, p_date) returning id into nid;
  return nid;
end $$;

-- Nouvelle version d'une rubrique : même principe
create or replace function public.paie_nouvelle_version_rubrique(
  p_entreprise uuid, p_code text, p_libelle text, p_type text, p_taux_defaut numeric,
  p_imposable boolean, p_transport boolean, p_logement boolean, p_heures_sup boolean, p_date date)
returns uuid language plpgsql security invoker as $$
declare nid uuid;
begin
  if not public.terh_admin(p_entreprise) then raise exception 'Droit insuffisant pour modifier les rubriques'; end if;
  if p_code is null or p_libelle is null or p_type not in ('gain','retenue') or p_date is null then
    raise exception 'Code, libellé, type (gain ou retenue) et date d''effet sont obligatoires';
  end if;
  if exists (select 1 from public.paie_rubriques
              where entreprise_id is not distinct from p_entreprise and code = p_code
                and date_fin is null and date_effet >= p_date) then
    raise exception 'Une version existe déjà à cette date ou après : choisissez une date postérieure';
  end if;
  update public.paie_rubriques set date_fin = p_date
   where entreprise_id is not distinct from p_entreprise and code = p_code and date_fin is null;
  insert into public.paie_rubriques (entreprise_id, code, libelle, type, taux_defaut,
      imposable, transport, logement, heures_sup, date_effet)
    values (p_entreprise, p_code, p_libelle, p_type, p_taux_defaut,
      coalesce(p_imposable, true), coalesce(p_transport, false), coalesce(p_logement, false),
      coalesce(p_heures_sup, false), p_date) returning id into nid;
  return nid;
end $$;

-- ####### fiche-paie-lot-a.sql #######
-- LOT A : champs de paie et de poste de la fiche salarié (comme Sage Paie).
-- À exécuter dans Supabase → SQL Editor après les autres scripts déjà exécutés.
alter table public.employes
  add column if not exists salaire_base      numeric(14,2),
  add column if not exists horaire           numeric(8,2) default 173.33,
  add column if not exists periodicite       text default 'mois',
  add column if not exists modele_bulletin   text,          -- code du modèle ; vide = modèle par défaut de la société
  add column if not exists convention        text,
  add column if not exists categorie         text,
  add column if not exists niveau            text,
  add column if not exists indice            text,
  add column if not exists coefficient       text,
  add column if not exists date_anciennete   date,
  add column if not exists date_entree_profession date,
  add column if not exists type_entree       text,
  add column if not exists etablissement     text;
