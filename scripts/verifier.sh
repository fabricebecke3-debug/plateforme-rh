#!/usr/bin/env bash
# Contrôle avant mise en ligne de index.html (et des autres fichiers JavaScript).
# Prérequis : Node.js. Usage :  ./verifier.sh chemin/vers/index.html
# Le script s'arrête au premier problème et indique lequel.

set -uo pipefail
FICHIER="${1:-index.html}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
erreurs=0

[ -f "$FICHIER" ] || { echo "Fichier introuvable : $FICHIER"; exit 1; }

# 1) Syntaxe de chaque script en ligne
python3 - "$FICHIER" "$TMP" <<'PY'
import re,sys
src=open(sys.argv[1],encoding='utf-8').read()
blocs=[b for b in re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',src,flags=re.S) if b.strip()]
for i,b in enumerate(blocs):
    open(f"{sys.argv[2]}/bloc{i}.js",'w',encoding='utf-8').write(b)
print(len(blocs))
PY
for f in "$TMP"/bloc*.js; do
  if ! node --check "$f" 2>"$TMP/err.txt"; then
    echo "ERREUR de syntaxe dans $(basename "$f") :"; head -5 "$TMP/err.txt"; erreurs=$((erreurs+1))
  fi
done

# 2) Éléments critiques qui doivent exister
for motif in 'id="af"' 'id="apsh"' 'id="v-own"' 'id="v-a"' 'id="imp"' 'AideAvatar.start' 'terh_co' 'let OTAB='; do
  if ! grep -q -- "$motif" "$FICHIER"; then echo "ABSENT : $motif"; erreurs=$((erreurs+1)); fi
done

# 3) Erreur classique : appel d'une variable avant son initialisation (cause de l'écran de connexion bloqué)
if grep -nE "^[[:space:]]*mount\(\);" "$FICHIER" >/dev/null; then
  echo "ATTENTION : appel immédiat de mount() détecté (risque 'before initialization')."; erreurs=$((erreurs+1))
fi

# 4) Taille du fichier (au-delà de 1 Mo, prévoir le découpage en modules)
taille=$(wc -c < "$FICHIER")
if [ "$taille" -gt 1048576 ]; then echo "INFO : fichier de $((taille/1024)) Ko, pensez au découpage en modules."; fi

if [ "$erreurs" -eq 0 ]; then echo "OK : contrôles passés pour $FICHIER"; exit 0; fi
echo "$erreurs problème(s) à corriger avant mise en ligne."; exit 1
