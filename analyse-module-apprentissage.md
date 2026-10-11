# Analyse du module Apprentissage — manquements et plan d'action

**Date d'analyse :** octobre 2026. **Périmètre :** page Apprentissage (onglets Cours, Exercices, QCM, Documents, Progression, Aide, Apprenants), fenêtre de lecture, fonctions serveur `formation-comptes`, contenus du dossier `formation/`.

**Méthode.** Analyse du code réel et des contrôles automatiques. Les statuts « corrigé » ont été testés dans un navigateur simulé. Rien n'a été testé dans un navigateur réel ni sur la base de production.

## 1. Synthèse

| Niveau | Nombre | Statut |
|---|---|---|
| Critique | 2 | 1 corrigé, 1 à faire par vous (déploiement) |
| Élevé | 4 | 3 corrigés, 1 décision à prendre |
| Moyen | 5 | 2 corrigés, 3 à planifier |

## 2. Manquements et statut

### Critiques
| # | Manquement | Impact | Statut |
|---|---|---|---|
| C1 | Les exercices réussis et les cours lus n'étaient pas enregistrés. | La progression ne reflétait pas le travail réel de l'apprenant. | **Corrigé** : chaque exercice juste et chaque cours ouvert sont enregistrés. |
| C2 | La fonction serveur `formation-comptes` n'est pas déployée sur votre projet. | Invitations, gestion des apprenants et progression sont inactives. | **À faire par vous** : `supabase functions deploy formation-comptes`, puis exécuter `sql/formation-comptes.sql`. |

### Élevés
| # | Manquement | Impact | Statut |
|---|---|---|---|
| E1 | La progression affichait des noms bruts (« qcm-tous »). | Illisible pour un apprenant. | **Corrigé** : libellés lisibles et résumé (activités terminées, score moyen). |
| E2 | Les onglets n'étaient pas accessibles (pas de rôles, pas de navigation au clavier). | Inutilisables pour un lecteur d'écran ou au clavier seul. | **Corrigé** : rôles ARIA, flèches, Début et Fin. |
| E3 | Le focus n'était pas rendu après la fermeture de la fenêtre de lecture. | Perte de repère au clavier. | **Corrigé**. |
| E4 | Aucun seuil de réussite ni attestation de fin de formation. | Impossible de savoir si une formation est validée. | **Décision à prendre** : seuil (proposition : 70 % au QCM) et contenu de l'attestation. |

### Moyens
| # | Manquement | Statut |
|---|---|---|
| M1 | Pas de parcours ni de prérequis entre les cours. | À planifier : ordre recommandé, pas de blocage. |
| M2 | Les modules 1.6, 2.2 à 2.5 et 3.4 sont encore à rédiger. | À planifier. Les taux CNPS et impôts doivent être confirmés sur cnps.cm avant rédaction. |
| M3 | Le QCM ne garde que le score global par thème, sans détail par question. | À planifier : historique par question si vous le souhaitez. |
| M4 | Pas de mesure d'efficacité au-delà de la satisfaction (niveaux 3 et 4 du modèle à 4 niveaux). | À planifier avec les responsables des services. |
| M5 | Les tests n'ont pas été faits dans un vrai navigateur ni sur votre base. | À faire par vous sur un compte de test (voir la liste de vérification). |

## 3. Points qui exigent une validation juridique ou une décision

1. **Contenu juridique** : tous les cours et QCM marqués ⚖️ doivent être relus par un juriste camerounais avant d'être diffusés à de vrais salariés. Les références de texte sont vérifiées ; les décrets, conventions et barèmes ne le sont pas.
2. **Documents importés** : le propriétaire doit s'assurer qu'il a le droit de diffuser le document à ses apprenants (droit d'auteur, données personnelles).
3. **Lecture du texte intégral** : le texte extrait d'un document importé est lisible par tous les apprenants. C'est le choix retenu ; s'il ne convient pas, il faut restreindre l'accès à une société.

## 4. Liste de vérification à faire vous-même

- [ ] Déployer `formation-comptes` et exécuter `sql/formation-comptes.sql` et `sql/formation-documents.sql`.
- [ ] Sur un compte de test : ouvrir un cours, le fermer par le bouton, puis par Échap.
- [ ] Faire un exercice juste : vérifier qu'il apparaît dans l'onglet Progression.
- [ ] Lire un cours : vérifier qu'il apparaît aussi.
- [ ] Naviguer entre les onglets avec les flèches du clavier.
- [ ] Importer un fichier Word, puis un PDF avec texte, puis un PDF scanné (doit être refusé avec son message).
- [ ] Poser une question à l'assistant sur le contenu d'un document importé.

## 5. Prochaine étape recommandée

Commencer par C2 (déploiement) : sans lui, la plupart des fonctions de progression restent inactives. Ensuite, trancher E4 (seuil et attestation), qui conditionne la valeur réelle de la formation pour l'employeur.
