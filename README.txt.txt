DÉPLOIEMENT PLATEFORME RH — v3.0
==================================

1. LANCER LE SCRIPT
   python3 apply_patch.py
   → génère index_fixed.html

2. TESTER EN LOCAL
   - Ouvre index_fixed.html dans Chrome ou Edge récent.
   - Connecte-toi, vérifie :
     • Cover visible dans une lettre (aperçu + impression)
     • Onglet Sanction dans Paramètres
     • Centre de contrôle → ent / bib / mt
     • Chat IA : uploader un PDF dans Bibliothèque, couper le WiFi, poser une question
     • Langue FR/EN sur le chat + voix

3. BASCULER EN PRODUCTION
   - Renomme index.html → index.bak.html  (garde-le quelque part)
   - Renomme index_fixed.html → index.html
   - Vérifie que manifest.webmanifest, sw.js, icon-192.png, icon-512.png,
     sage-data.json sont tous dans le même dossier.

4. DÉPLOYER
   Netlify :   glisser-déposer le dossier sur netlify.com/drop
   Vercel :    vercel deploy --prod
   GitHub :    git add . && git commit -m "v3" && git push

5. POST-DÉPLOIEMENT
   - Ouvrir l'app en HTTPS (obligatoire pour micro, notifications, PWA)
   - Autoriser micro + notifications une fois (le navigateur mémorise)
   - Tester le bouton 🔓 (permissions) dans la barre du bas

FICHIERS DE SECOURS (à garder hors ligne)
==========================================
- index.bak.html         (ancienne version fonctionnelle)
- sauvegarde-rh-*.json   (bouton Sauvegarde dans Espace propriétaire)