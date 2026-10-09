# Déploiement — Plateforme RH (guide pas à pas)

## 0. Ce que contient cette livraison
| Dossier | Contenu | Où le mettre |
|---|---|---|
| `index.html`, `aide-avatar.js`, `sw.js` | application et assistant | **racine du site** (même dossier) |
| `formation/` | QCM, assistant de formation, cours, salariés fictifs | **racine du site**, dossier `formation/` |
| `outils/calculs-rh.js` | calculs RH | **racine du site**, dossier `outils/` |
| `sql/` | scripts de base de données | **Supabase > SQL Editor** |
| `supabase/functions/` | fonctions serveur | **Supabase CLI** (déploiement) |
| `docs/` | politique, procédures, bases juridiques | consultation (non publié) |
| `scripts/`, `*.test.js`, `verifier-qcm.js` | contrôles automatiques | sur votre ordinateur |

## 1. Contrôler avant de mettre en ligne (sur votre ordinateur)
Ouvrez un terminal dans ce dossier, puis :
```
bash scripts/tout-tester.sh
```
Résultat attendu : « TOUT EST OK ». Pour tester le lecteur de QCM dans un navigateur simulé, installez Node.js puis `npm install jsdom` dans un dossier de test, et lancez `node test-navigateur-qcm.js` (copie fournie dans les fichiers de test).

## 2. Base de données (Supabase > SQL Editor)
Exécutez les scripts **dans cet ordre**, en contrôlant le résultat de chacun :
1. Les scripts de sécurité déjà utilisés (RLS, stockage des avatars, contrats, signatures) si vous ne les avez pas encore exécutés.
2. `sql/maintenance.sql` — durée de conservation du journal et contrôles.
3. `sql/formation-comptes.sql` — comptes d'apprenants et progression.

Si une erreur `relation does not exist` apparaît, la table n'existe pas chez vous : notez le nom et ne forcez rien.

## 3. Fonctions serveur (Supabase CLI)
Installez la CLI Supabase, connectez-vous, puis depuis la racine de ce dossier :
```
supabase functions deploy ai-chat
supabase functions deploy avatar-hedra
supabase functions deploy formation-comptes
```
(`avatar-video` est une variante HeyGen : ne la déployez que si vous avez une clé HeyGen.)

## 4. Secrets (Supabase > Edge Functions > Secrets)
Ne les mettez **jamais** dans `index.html` ni dans un fichier public.
| Secret | Utilisé par | Obligatoire |
|---|---|---|
| `GROQ_API_KEY` (et `_2`, `_3` si plusieurs clés) | ai-chat | au moins une clé IA |
| `OPENROUTER_API_KEY` | ai-chat | non |
| `GEMINI_API_KEY` | ai-chat | non |
| `HEDRA_API_KEY` | avatar-hedra | pour la vidéo parlante |
| `HEDRA_MODEL_ID` | avatar-hedra | facultatif (modèle Omnia pour les gestes du corps) |

## 5. Mettre le site en ligne
Copiez `index.html`, `aide-avatar.js`, `sw.js` et le dossier `formation/` (ainsi que `outils/`) à la racine de votre hébergement (Netlify, etc.), en gardant leur arborescence. Vérifiez que `manifest.webmanifest` existe toujours à la racine.

## 6. Contrôles après mise en ligne (compte de test, pas un vrai salarié)
1. La page de connexion s'affiche, la case « Afficher le mot de passe » fonctionne.
2. Après connexion, le bouton 💬 apparaît ; l'assistant répond à « comment calculer les congés ? » (base locale).
3. `formation/entrainement-qcm.html` : un QCM complet donne un score.
4. Le Centre de contrôle → Profil et web affiche « Assistant RH : paramètres ».

## 7. Ce qui n'est pas encore testé dans votre environnement réel
- Les appels réseau vers Supabase, Hedra et les fournisseurs d'IA (testés seulement en simulation).
- La reconnaissance vocale et la caméra : dépendent du navigateur et des autorisations.
- Les règles SQL : exécutez-les sur un projet de test avant la production.
