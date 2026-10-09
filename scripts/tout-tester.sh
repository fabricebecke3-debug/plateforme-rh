#!/usr/bin/env bash
# Lance tous les contrôles de la plateforme. Usage : bash scripts/tout-tester.sh
# Code de sortie : 0 si tout passe, 1 sinon (utilisable dans une automatisation).
set -uo pipefail
cd "$(dirname "$0")/.."
ECHECS=0
verdict() { if [ "$1" -eq 0 ]; then echo "OK : $2"; else echo "ÉCHEC : $2"; ECHECS=$((ECHECS+1)); fi; }

echo "=== 1. Calculs RH ==="
node outils/calculs-rh.test.js > /tmp/t1.txt 2>&1; verdict $? "calculs RH"; tail -1 /tmp/t1.txt
echo
echo "=== 2. Banque de QCM ==="
node formation/verifier-qcm.js > /tmp/t2.txt 2>&1; verdict $? "banque de QCM"; cat /tmp/t2.txt
echo
echo "=== 3. Assistant de formation ==="
node formation/test-assistant-formation.js > /tmp/t3.txt 2>&1; verdict $? "assistant de formation"; tail -1 /tmp/t3.txt
echo
echo "=== 4. Lecteur de QCM : chaque script séparément ==="
python3 - <<'PY' > /tmp/blocs.txt
import re
h=open('formation/entrainement-qcm.html',encoding='utf-8').read()
blocs=re.findall(r'<script>([\s\S]*?)</script>',h)
print(len(blocs))
for i,b in enumerate(blocs):
    open(f'/tmp/qcm-bloc{i}.js','w',encoding='utf-8').write(b)
PY
n=$(head -1 /tmp/blocs.txt)
for i in $(seq 0 $((n-1))); do
  node --check /tmp/qcm-bloc$i.js > /dev/null 2>&1; verdict $? "syntaxe du bloc $i du lecteur"
done
echo
echo "=== 4 bis. Fonctions serveur (erreurs de syntaxe uniquement) ==="
for f in supabase/functions/*/index.ts; do
  if timeout 10 node --experimental-strip-types "$f" 2>&1 | grep -q "SyntaxError"; then verdict 1 "syntaxe $f"; else verdict 0 "syntaxe $f"; fi
done
echo
echo "=== 4 ter. Anciens chiffres non vérifiés : interdits ==="
if grep -rqE "52,5 jours|42,5 jours|2,5 jours par mois de service|2\.5 jours par mois" formation outils 2>/dev/null; then verdict 1 "ancien chiffre de congé (2,5) encore présent"; else verdict 0 "aucun ancien chiffre de congé"; fi
echo
echo "=== 5. Application (index.html) ==="
if [ -f index.html ]; then bash scripts/verifier.sh index.html > /tmp/t5.txt 2>&1; verdict $? "application"; tail -1 /tmp/t5.txt; else echo "index.html absent de ce dossier"; ECHECS=$((ECHECS+1)); fi
echo
if [ "$ECHECS" -eq 0 ]; then echo "TOUT EST OK."; exit 0; fi
echo "$ECHECS contrôle(s) en échec. Corrigez-les avant mise en ligne."; exit 1
