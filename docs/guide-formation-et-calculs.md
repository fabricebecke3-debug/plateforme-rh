# Guide d'utilisation — formation et calculs RH

## Ce qui est inclus
| Fichier | Rôle |
|---|---|
| `formation/entrainement-qcm.html` | QCM interactif, à ouvrir dans un navigateur, sans connexion. Explications lues à voix haute (🔊). |
| `formation/qcm.json` | Banque des questions : modifiable sans coder (ajoutez une entrée au même format). |
| `formation/cours-et-exercices.md` | Cours et exercices corrigés : ancienneté, heures supplémentaires, congés, prorata. |
| `outils/calculs-rh.js` | Calculs de référence, utilisables dans un tableur ou une page. |
| `outils/calculs-rh.test.js` | Tests des calculs : la moindre régression est signalée. |
| `scripts/tout-tester.sh` | Lance tous les contrôles en une commande. |

## Pour un salarié ou un RH en apprentissage
1. Ouvrez `entrainement-qcm.html` dans Chrome ou Edge.
2. Choisissez un thème, puis cliquez sur **Commencer**.
3. Après chaque réponse, lisez l'explication, ou écoutez-la avec 🔊.
4. À la fin, revoyez les questions manquées.
5. Pour les calculs, suivez les exercices du cours, puis vérifiez vos résultats.

## Pour l'administrateur : ajouter une question
Dans `qcm.json`, ajoutez une entrée :
```json
{"id":"theme-3","theme":"Paie","niveau":"base","question":"...","choix":["A","B","C"],"reponse":1,"explication":"..."}
```
- `reponse` est l'indice de la bonne réponse, en commençant à 0.
- L'identifiant `id` doit être unique.
- Puis lancez `node formation/verifier-qcm.js` : il signale toute erreur.

## Pour l'administrateur : modifier un taux ou un paramètre
Les paramètres sont au début de `outils/calculs-rh.js` (`PARAMS`). Après toute modification :
1. Vérifiez le texte juridique applicable.
2. Lancez `node outils/calculs-rh.test.js`. Si un test échoue, c'est que la modification change un résultat attendu : vérifiez qu'elle est voulue, puis mettez à jour le test.

## Avertissement
Les calculs et les QCM sont des outils de formation et d'aide. Pour une paie réelle ou un litige, le texte officiel et un professionnel (juriste, expert-comptable, inspection du travail) font foi.

## Vérifier l'ensemble
```
bash scripts/tout-tester.sh
```
Tous les contrôles doivent afficher « OK ». Un « ÉCHEC » indique précisément le contrôle à corriger.
