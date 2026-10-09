# Procédure de sécurité — Plateforme RH

À appliquer une fois, puis à vérifier chaque trimestre.

## 1. Désactiver l'inscription libre (à faire maintenant)
1. Supabase → **Authentication** → **Sign In / Providers** → **Email**.
2. Désactivez **« Allow new users to sign up »**.
3. Les comptes sont créés par le propriétaire uniquement, depuis l'application.
4. Vérification : tentez de créer un compte depuis une fenêtre privée ; l'inscription doit être refusée.

## 2. Protéger le compte propriétaire
1. Mot de passe long et unique (au moins 16 caractères, gestionnaire de mots de passe).
2. Activez l'authentification à deux facteurs : Supabase → **Account** → **Multi-factor authentication**, puis application d'authentification (Google Authenticator, Microsoft Authenticator…).
3. Conservez les codes de secours hors de l'ordinateur habituel.
4. Ne partagez jamais le compte propriétaire : chaque administrateur a son propre compte.

## 3. Données publiques du propriétaire
- Les paramètres `owner_json`, `web_json`, `recit_plateforme` et `assistant_style` sont lisibles par les comptes de la société.
- Ne mettez dedans que des informations professionnelles publiques : nom, fonction, coordonnées professionnelles, description de la plateforme.
- Jamais : pièces d'identité, adresse personnelle, données de santé, salaires.
- Contrôle : exécutez la dernière requête de `sql/maintenance.sql`.

## 4. Sauvegardes
- **Hebdomadaire** : lancez `scripts/sauvegarde.sh` avec la chaîne de connexion (Supabase → Settings → Database). Planifiez-le (cron ou Planificateur de tâches).
- Stockez les fichiers sur un support chiffré, séparé de l'ordinateur de travail.
- Les sauvegardes contiennent des données personnelles : accès restreint.

## 5. Test de restauration (chaque trimestre)
1. Restaurez la dernière sauvegarde dans une base de test (jamais en production).
2. Vérifiez : nombre d'employés, dernier contrat, dernier journal d'audit.
3. Notez la date du test et son résultat dans le registre ci-dessous.

| Date | Sauvegarde testée | Résultat | Par |
|---|---|---|---|
|  |  |  |  |

## 6. Avant chaque mise en ligne
1. Lancez `scripts/verifier.sh index.html`. Il doit afficher « OK ».
2. Testez sur un compte de démonstration : connexion, liste du personnel, import, alertes, assistant.
3. Gardez une copie datée de la version précédente.

## 7. En cas d'incident (fuite, accès non autorisé)
1. Changez immédiatement le mot de passe du compte concerné et révoquez ses sessions (Supabase → Authentication → Users).
2. Consultez le journal d'audit (Centre de contrôle → Audit) pour identifier les actions.
3. Prévenez le responsable de la protection des données et votre juriste.
4. Documentez l'incident : date, nature, données concernées, mesures prises.
