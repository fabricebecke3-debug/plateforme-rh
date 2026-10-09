# Gestion des apprenants — procédure

## Ce qu'il faut installer (une fois)
1. **Base de données** : Supabase → SQL Editor → exécuter `sql/formation-comptes.sql`.
2. **Fonction serveur** : déployer `supabase/functions/formation-comptes` avec la CLI Supabase :
   `supabase functions deploy formation-comptes`
3. **Invitations par e-mail** : Supabase → Authentication → Email Templates. Adaptez le modèle d'invitation (nom de la plateforme, langue française).
4. **Inscription libre désactivée** (voir `docs/procedure-securite.md`) : seuls les comptes invités peuvent entrer.

## Inviter un apprenant (propriétaire ou administrateur de la société)
Appel de la fonction, par exemple depuis la console du navigateur connecté :
```js
await db.functions.invoke('formation-comptes', { body: { action: 'inviter', email: 'nom@exemple.com', nom: 'Prénom Nom', entreprise_id: 'ID-DE-LA-SOCIETE' } });
```
L'apprenant reçoit un e-mail d'invitation, crée son mot de passe, puis se connecte.

## Voir et gérer les apprenants
```js
await db.functions.invoke('formation-comptes', { body: { action: 'lister', entreprise_id: 'ID' } });
await db.functions.invoke('formation-comptes', { body: { action: 'suspendre', id: 12 } });   // bloque l'accès
await db.functions.invoke('formation-comptes', { body: { action: 'reactiver', id: 12 } });   // rétablit l'accès
```
Un administrateur ne gère que les apprenants de sa propre société. Le propriétaire les gère tous.

## Enregistrer la progression (fait par l'apprenant)
```js
await db.functions.invoke('formation-comptes', { body: { action: 'progres', module: '1.1', score: 85, termine: true } });
```
Chacun ne voit que sa progression ; l'administrateur voit celle des apprenants de sa société.

## Points de contrôle
- Après une invitation, la ligne apparaît dans `formation_apprenants` avec le statut « invite ». Elle passe à « actif » une fois l'accès utilisé.
- Un apprenant suspendu ne peut plus se connecter. Vérifiez-le avec un compte test.
- Les données de progression sont personnelles : elles ne doivent servir qu'à la formation, pas à une évaluation de performance sans information préalable de la personne.

## Limites actuelles
- Les appels ci-dessus se font depuis la console ; il n'existe pas encore d'écran dédié dans l'application. C'est la prochaine étape si vous en avez besoin.
- Le suivi de progression n'est pas encore relié au lecteur de QCM : il faudra appeler `progres` à la fin de chaque module.
- La fonction n'a pas été exécutée sur votre base : vérifiez-la sur un compte test avant d'inviter de vraies personnes.
