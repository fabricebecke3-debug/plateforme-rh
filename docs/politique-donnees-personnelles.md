# Politique de protection des données personnelles — PROJET

> **Document de travail.** Il doit être relu et validé par un juriste spécialisé en droit camerounais des données personnelles et en droit du travail avant toute utilisation. Les durées et les délais indiqués entre crochets [ ] sont à confirmer.

## 1. Responsable du traitement
[Raison sociale de la société utilisatrice] — [adresse] — [contact du responsable].
Pour la plateforme elle-même : [nom du propriétaire] — [contact].

## 2. Données traitées
- **Identité et contact** : nom, prénoms, date et lieu de naissance, adresse, téléphone, e-mail.
- **Vie professionnelle** : poste, contrat, date d'embauche, période d'essai, congés, absences, évaluations, formations, sanctions.
- **Rémunération et sécurité sociale** : salaire, numéro CNPS, déclarations sociales et fiscales.
- **Pièces** : carte nationale d'identité (date d'expiration), contrats signés, certificats, dossier de sortie.
- **Données sensibles** : toute information relative à la santé (visite médicale d'aptitude) ne doit être conservée que dans la mesure strictement nécessaire.
- **Journal d'activité** : qui a modifié quelle donnée, quand.

## 3. Finalités
Gestion administrative du personnel, paie et déclarations sociales, suivi des contrats et des échéances, obligations de conservation légale. Aucune finalité commerciale. Aucune prise de décision automatisée sur les salariés.

## 4. Base légale
[Exécution du contrat de travail ; obligations légales ; intérêt légitime — à préciser par le juriste].

## 5. Durées de conservation
| Catégorie | Durée proposée | Base |
|---|---|---|
| Dossier du salarié | [durée après la fin du contrat] | [texte applicable] |
| Bulletins de paie et déclarations sociales | [durée légale] | [texte applicable] |
| Pièces d'identité | [durée minimale nécessaire] | à valider |
| Journal d'audit | [5 ans proposés] | à valider |
| Candidatures non retenues | [durée courte] | à valider |

Le journal d'audit est purgé selon la durée configurée (`sql/maintenance.sql`).

## 6. Destinataires
Les personnes habilitées de la société (selon leur rôle et leur module). Les prestataires techniques (hébergement, base de données, services d'IA) sous contrat de sous-traitance. Aucun transfert hors du territoire sans garanties à définir avec le juriste.

## 7. Droits des personnes (salariés)
Droit d'accès, de rectification, d'effacement dans les limites légales, d'opposition et de réclamation. Demande : [adresse ou formulaire], réponse dans un délai de [délai à confirmer].

## 8. Sécurité
- Cloisonnement des données par société (règles d'accès au niveau de la base).
- Authentification forte pour le propriétaire.
- Inscription libre désactivée ; comptes créés par le propriétaire.
- Sauvegardes chiffrées, testées chaque trimestre.
- Journal des modifications.

## 9. Violation de données
Procédure : confinement immédiat, évaluation du risque, notification à l'autorité compétente et aux personnes concernées dans les délais légaux [à confirmer], documentation de l'incident.

## 10. Assistant IA
L'assistant peut répondre à des questions à partir de données de l'application. Il se présente comme un assistant IA. Les données transmises à son fournisseur doivent être limitées au nécessaire ; le juriste doit vérifier les conditions de ce fournisseur avant la mise en service.

## 11. Mise à jour
Dernière révision : [date]. Validation juridique : [nom du juriste, date].
