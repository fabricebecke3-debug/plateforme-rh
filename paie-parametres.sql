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
