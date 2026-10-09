#!/usr/bin/env bash
# Lance tous les contrôles de la plateforme en une commande.
# Usage (depuis le dossier outputs) :  bash scripts/tout-tester.sh
# Prérequis : Node.js (version 16 ou plus récente) et Python 3.
set -uo pipefail
cd "$(dirname "$0")/.."
echo "=== 1. Calculs RH (ancienneté, heures supplémentaires, congés, prorata) ==="
node outils/calculs-rh.test.js || echo "ÉCHEC : calculs"
echo
echo "=== 2. Banque de QCM (structure et réponses) ==="
node formation/verifier-qcm.js || echo "ÉCHEC : QCM"
echo
echo "=== 3. Lecteur de QCM (syntaxe du script) ==="
python3 - <<'PY' > /tmp/qcm-lecteur.js
import re
h=open('formation/entrainement-qcm.html',encoding='utf-8').read()
print(re.search(r'<script>([\s\S]*)</script>',h).group(1))
PY
node --check /tmp/qcm-lecteur.js && echo "OK : lecteur de QCM" || echo "ÉCHEC : lecteur de QCM"
echo
echo "=== 4. Application (index.html) ==="
if [ -f index.html ]; then bash scripts/verifier.sh index.html || echo "ÉCHEC : application"; else echo "index.html absent dans ce dossier"; fi
echo
echo "Fin des contrôles. Un ÉCHEC indique le contrôle à corriger avant mise en ligne."
