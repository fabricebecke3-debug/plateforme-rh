PLATEFORME RH - FICHIERS A DEPLOYER (meme dossier)
====================================================
index.html            application (remplace l'ancien)
manifest.webmanifest  installation mobile
sw.js                 service worker (index.html en réseau d'abord)
icon-192.png, icon-512.png
lang-en.js            traductions anglaises complémentaires (à garder à côté de index.html)
_headers              règles de cache (Netlify / Cloudflare Pages)
sage-data.json        A AJOUTER : votre fichier existant (non fourni ici)

NOUVEAUTES
- Paramètres > "En-tête lettres" : société, adresse, tél, email, service, mentions légales,
  société mère (mise à disposition automatique ou forcée), image du papier à en-tête.
- Variable {{ENTETE_BLOC}} dans les modèles (les anciens modèles sont convertis automatiquement).
  Autres variables : {{SERVICE}}, {{SOCIETE_MERE}}.
- Import de modèles : Word, PDF, TXT, HTML, RTF, image (OCR) - onglets Lettre, Certificat, DE, Sanction
  et Centre de contrôle > Papier à en-tête.
- Centre de contrôle : onglets Papier à en-tête, Bibliothèque, Maintenance.
- Onglet "Modèle Sanction" ajouté dans Paramètres.
- Cover dans les lettres, certificats et impressions en lot (sans doublon).
- Si la base refuse les clés ent_*, l'en-tête est gardé sur l'appareil (message affiché).

TEST : console > typeof window.TERH_bibAdd et typeof window.TERH_tplFromFile = "function".

LANGUE (FR / EN)
- Le traducteur de l'application fonctionne avec un dictionnaire exact : un texte absent reste en français.
- Pour traduire un texte manquant : ajoutez une ligne dans lang-en.js  'texte français exact':'English text',
  puis rechargez la page. Les émojis au début et la ponctuation à la fin sont ignorés.
- Test rapide dans la console : TERH_I18N_add({'Bonjour':'Hello'})
- Les textes mélangés (ex. « Tableaux of bord ») viennent de l'ancien remplacement mot à mot : il est désormais
  désactivé quand il laisse du français dans la phrase ; ajoutez la phrase complète dans lang-en.js.
