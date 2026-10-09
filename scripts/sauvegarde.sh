#!/usr/bin/env bash
# Sauvegarde de la base de la Plateforme RH.
# Prérequis : PostgreSQL client (pg_dump) installé ; chaîne de connexion Supabase (Settings > Database).
# Usage :   DB_URL="postgresql://..." ./sauvegarde.sh
# Conseil : planifier chaque semaine (cron sous Linux/macOS, Planificateur de tâches sous Windows).
# Les fichiers contiennent des données personnelles : stockez-les dans un lieu sécurisé et chiffré.

set -euo pipefail

if [ -z "${DB_URL:-}" ]; then
  echo "Erreur : définissez DB_URL (chaîne de connexion Supabase)." >&2
  exit 1
fi

DOSSIER="${DOSSIER_SAUVEGARDE:-$HOME/sauvegardes-terh}"
mkdir -p "$DOSSIER"
DATE="$(date +%Y-%m-%d_%H%M)"
FICHIER="$DOSSIER/terh-$DATE.dump"

# Format « custom » : compressé, restaurable sélectivement
pg_dump "$DB_URL" --format=custom --no-owner --no-privileges --file="$FICHIER"

# Vérification minimale : le fichier existe et n'est pas vide
test -s "$FICHIER" || { echo "Sauvegarde vide : échec." >&2; exit 1; }

# Conserver les 12 dernières sauvegardes seulement
ls -1t "$DOSSIER"/terh-*.dump | tail -n +13 | xargs -r rm -f

echo "Sauvegarde créée : $FICHIER"
