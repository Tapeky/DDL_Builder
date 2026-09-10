# Deadlock / Atelier

Un premier site en français pour explorer le catalogue de Deadlock et préparer un parcours d’achat expliqué. Next.js sert l’interface ; NestJS porte les règles métier et les imports ; PostgreSQL conserve les versions du catalogue et les builds partagés.

**Ce n’est pas encore un moteur de builds statistiques ni un produit prêt pour une exploitation publique.** La collecte d’analytics est disponible pour l’audit, mais elle ne pondère pas encore les recommandations. Les builds sont des brouillons expérimentaux non validés par des joueurs experts. Aucun taux de victoire n’est affiché ou inventé.

## Fonctionnalités de cette version

- Import réel des héros jouables et des objets de boutique standards, en français, depuis Deadlock API.
- Version du client fixée avant les deux téléchargements, validation des données externes et publication atomique d’un catalogue immuable.
- Cinq héros couverts : Infernus, Seven, Abrams, Haze (Nébula en français) et Ivy (Lyanne en français).
- Trois orientations par héros : équilibrée, offensive et survie. Chaque parcours explique huit achats en trois phases.
- Déduction des composants déjà achetés, y compris les composants transitifs, sans double crédit.
- Catalogue filtrable par catégorie et nom, descriptions et composants consultables.
- Builds sauvegardés et partageables par URL : un nouvel import ne réécrit pas les anciens liens.
- Signalement explicite des données absentes ou non vérifiées depuis 24 heures ; un import échoué ne détruit pas le dernier catalogue valide.
- Builds éditoriaux versionnés dans PostgreSQL, back-office protégé et revalidation automatique après changement de catalogue.
- Collecte manuelle des statistiques d’achats avec fenêtre, modes, rang, fortune et adversaires conservés comme filtres auditables.
- Collecte des performances par héros pour les seuls profils de référence vérifiés, puis affichage de ces repères dans les recommandations.

Les objets spéciaux de niveau 5 sont exclus. Les versions importées sont des **versions du client**, pas des dates de patch vérifiées. La fraîcheur du catalogue ne vaut pas validation des builds pour la méta actuelle.

## Démarrage local

Prérequis : Node.js 24, pnpm 11.15.1, Docker avec Compose, et un accès sortant HTTPS à Deadlock API.

```bash
cp .env.example .env
```

Remplacer le mot de passe local dans `POSTGRES_PASSWORD` et dans `DATABASE_URL` par la même valeur. Utiliser une valeur URL-encodée dans l’URL si elle contient des caractères réservés. Ne jamais committer `.env`.

Pour ouvrir le back-office local, ajouter aussi un `ADMIN_TOKEN` long et aléatoire dans `.env`. Cette valeur ne doit jamais être placée dans le frontend, le dépôt ou une capture d’écran.

```bash
pnpm install
pnpm dev:setup
```

`pnpm dev:setup` démarre PostgreSQL, génère le client Prisma, applique les migrations,
synchronise le catalogue puis lance l'API et le frontend en mode développement.

- Site : http://localhost:3000
- API : http://localhost:3001/v1/health
- Documentation OpenAPI : http://localhost:3001/docs

Sans import, le site affiche un état vide explicite ; aucune donnée de démonstration ne remplace les données du jeu. Les fixtures synthétiques sont réservées aux tests.

Pour exécuter les versions de production localement :

```bash
pnpm build
pnpm start
```

`API_URL` est une variable **serveur du frontend**, sans préfixe `NEXT_PUBLIC_`. Sa valeur doit être définie dans l’environnement de construction Next.js si elle diffère de `http://127.0.0.1:3001`. Les appels du navigateur passent par `/api/v1/*`, réécrits vers `/v1/*` côté NestJS. Le frontend n’accède jamais directement à PostgreSQL.

## Actualiser le catalogue

```bash
pnpm data:sync
```

L’import choisit la version maximale annoncée par `/v1/assets/client-versions`, puis charge les héros et objets avec le même `client_version` et `language=french`. Le contenu normalisé est identifié par une empreinte SHA-256 ; réimporter le même contenu ne crée pas de nouveau snapshot. Une transaction et un verrou PostgreSQL protègent la publication concurrente. Une version plus ancienne ne peut pas remplacer une version plus récente.

Les erreurs et horaires des imports sont enregistrés dans `SyncRun`. Aucun endpoint HTTP public ne permet de déclencher une synchronisation. Les réponses 429 et 5xx font l’objet de tentatives espacées et bornées, avec prise en compte de `Retry-After`. Les erreurs réseau ou de validation font échouer l’import sans publication partielle.

## Workflow éditorial

La phase éditoriale ajoute les modèles `EditorialBuild`, `EditorialBuildVersion`, `EditorialBuildStep` et `PatchChange`. Les règles initiales servent uniquement à amorcer les 15 builds lors du premier import ; les recommandations publiques lisent ensuite PostgreSQL. Une révision créée depuis le back-office devient un brouillon et ne remplace jamais la révision partagée précédente.

Le back-office est accessible sur `/admin` et protégé par un jeton Bearer. Il permet de lister les builds, modifier le titre, le résumé, les phases, les objets, les raisons et les paliers d’investissement, ajouter ou supprimer des achats, créer une copie pour un autre héros/style, publier ou archiver une révision. Il permet aussi d’éditer les profils tactiques héros par héros ; un profil en brouillon ou obsolète ne déclenche aucune adaptation publique. Les API correspondantes sont sous `/v1/admin/builds` et `/v1/admin/tactical-profiles` et refusent les requêtes sans `Authorization: Bearer ...`.

Lorsqu’une nouvelle version du client est importée, le service compare les héros et les champs qui affectent les achats : nom, catégorie, niveau, prix et composants. Les versions non touchées sont recopiées vers le nouveau snapshot ; les builds qui référencent un héros ou un objet modifié deviennent `stale` et disparaissent des recommandations publiées jusqu’à leur relecture. Le détail de la transition est conservé dans `PatchChange`. Les builds partagés précédents restent lisibles parce que leur payload est immuable.

Après avoir déployé cette migration sur une base qui contenait déjà le catalogue de la première version, exécuter `pnpm data:sync` une fois pour amorcer les versions éditoriales. La commande est idempotente et détecte aussi un snapshot existant sans builds.

Cette livraison fournit une **commande manuelle**, pas encore un ordonnanceur. Une tâche planifiée exécutant `node apps/api/dist/sync.js` pourra l’appeler après compilation. Redis/BullMQ reste différé tant qu’il n’y a pas de traitement analytique ou de file de travaux à gérer.

## Preuves statistiques

La collecte manuelle `POST /v1/admin/analytics/item-stats` enregistre une fenêtre temporelle, le mode, le filtre de rang, la fortune, les héros adverses et le seuil minimal de matchs avec chaque run. Les lignes brutes d’achats sont conservées avec leurs compteurs et temps moyens dans `AnalyticsItemStat` ; un échec ne publie aucun agrégat partiel et chaque nouvelle tentative crée un run immuable.

Les profils de référence sont gérés séparément par `ReferencePlayer`. Un nom Steam et `possible_account_ids` ne suffisent pas à prouver une identité : le statut `verified` doit rester une décision éditoriale et sa source doit être renseignée. Cette tranche ne déduit pas la position de farm 1–6, la lane ou le statut professionnel depuis les analytics ; ces dimensions restent à mesurer avant d’être utilisées par le moteur.

La sélection initiale conserve les réponses de `/v1/leaderboard/{region}/{hero_id}` dans `LeaderboardRun` et `LeaderboardCandidate`. La source ne fournit pas de champ d’activité ; `startedAt` indique donc l’instant d’observation, tandis que le classement, les héros principaux et les `possible_account_ids` restent des indices non vérifiés. Les IDs répétés dans une même ligne sont dédupliqués, mais deux lignes partageant un pseudo ne sont jamais fusionnées. Depuis le back-office, un candidat peut être promu manuellement vers `ReferencePlayer` en statut `pending`, ou rejeté ; aucune collecte ne crée automatiquement une identité vérifiée.

Une seconde collecte manuelle interroge `/v1/players/hero-stats` uniquement avec les `accountIds` de profils `verified` associés au héros. Chaque `ReferenceStatRun` est lié au snapshot du catalogue et conserve les lignes par compte dans `ReferenceHeroStat`. La recommandation lit le dernier run réussi de sa version et affiche, par joueur encore vérifié, le volume de parties, la dernière activité et des rythmes moyens pondérés par le temps de jeu. Ces mesures fournissent un contexte observable ; elles ne réordonnent pas les achats et ne valident pas le build éditorial.

## Structure

```text
apps/api/src/
  catalog/          Adaptateur externe, normalisation, import et lecture des snapshots
  editorial/        Builds versionnés, seed initial et workflow de patch
  recommendations/  Calcul des achats, contexte adverse et lecture des builds
  tactical/         Tags de menaces, profils versionnés et validation éditoriale
  analytics/        Collecte manuelle et agrégats d’achats versionnés
  references/       Profils de joueurs de référence, candidats leaderboard et vérification éditoriale
  admin/            API protégée du back-office éditorial
  database.module.ts
apps/api/prisma/    Schéma PostgreSQL et migrations
apps/web/          Application Next.js responsive
packages/contracts/ Types des réponses et requêtes consommés par le frontend
tests/             Parcours Playwright sur l’API et le frontend réels
```

Le catalogue normalisé est stocké en JSONB dans `CatalogSnapshot`, avec un pointeur `CatalogHead`, des `SavedBuild` immuables et des `SyncRun`. Les builds éditoriaux, leurs achats et leurs paliers d’investissement sont relationnels pour rester éditables, audités et versionnés. Les profils tactiques sont recopiés à chaque snapshot ; les profils des héros dont les données changent passent automatiquement à `stale`. Le projet évite encore de créer prématurément un entrepôt de matchs. Les types partagés sont écrits à la main pour cette tranche ; le client généré depuis OpenAPI reste à faire.

Le seed de départ est dans `apps/api/src/editorial/seed-data.ts`, tandis que `apps/api/src/recommendations/engine.ts` ne contient que la validation et le calcul générique des achats. Toute évolution métier doit incrémenter `ENGINE_VERSION` et ajouter des tests. Les anciens builds sauvegardés conservent leur payload, même après modification du moteur.

## API

| Route                                                | Fonction                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /v1/health`                                     | Vérification du service et de PostgreSQL                                             |
| `GET /v1/catalog`                                    | Héros, objets, tags tactiques et profils versionnés                                  |
| `GET /v1/data-status`                                | Source, version, dates et fraîcheur                                                  |
| `GET /v1/heroes?version=...`                         | Héros d’une version importée                                                         |
| `GET /v1/items?version=...&category=spirit`          | Objets et filtre de catégorie                                                        |
| `GET /v1/tactical-profiles?version=...`              | Tags disponibles et profils tactiques d’une version                                  |
| `POST /v1/recommendations`                           | `{ "heroId": 1, "style": "balanced", "farmPriority": 1, "opponentHeroIds": [2, 6] }` |
| `GET /v1/builds/:id`                                 | Payload immuable du build partagé                                                    |
| `GET /v1/admin/builds`                               | Liste protégée des révisions éditoriales courantes                                   |
| `GET /v1/admin/builds/:id`                           | Détail protégé d’un build éditorial                                                  |
| `PATCH /v1/admin/builds/:id`                         | Crée une nouvelle révision brouillon                                                 |
| `POST /v1/admin/builds/:id/publish`                  | Valide les objets et publie la révision courante                                     |
| `POST /v1/admin/builds/:id/archive`                  | Archive la révision courante                                                         |
| `GET /v1/admin/tactical-profiles`                    | Liste protégée des profils tactiques et définitions de tags                          |
| `PATCH /v1/admin/tactical-profiles/:heroId`          | Révise les tags, leur intensité, leur preuve et le statut du profil                  |
| `GET /v1/admin/analytics/runs`                       | Liste les collectes statistiques protégées                                           |
| `GET /v1/admin/analytics/runs/:id`                   | Détail et lignes d’une collecte                                                      |
| `POST /v1/admin/analytics/item-stats`                | Collecte des achats avec fenêtre et filtres explicites                               |
| `GET /v1/admin/reference-players`                    | Liste les joueurs de référence protégés                                              |
| `POST /v1/admin/reference-players`                   | Enregistre un profil de référence en attente de vérification                         |
| `PATCH /v1/admin/reference-players/:id`              | Met à jour un profil et son statut de vérification                                   |
| `GET /v1/admin/leaderboards/runs`                    | Liste les runs leaderboard et leurs candidats par version, héros et région           |
| `POST /v1/admin/leaderboards/collect`                | Collecte un leaderboard de héros et conserve les candidats bruts normalisés          |
| `POST /v1/admin/leaderboards/candidates/:id/promote` | Promeut manuellement un candidat vers un profil `pending`                            |
| `POST /v1/admin/leaderboards/candidates/:id/reject`  | Rejette manuellement un candidat                                                     |
| `GET /v1/admin/reference-stats/runs`                 | Liste les collectes de performances des références vérifiées                         |
| `POST /v1/admin/reference-stats/collect`             | Collecte les statistiques du héros pour les seuls comptes vérifiés                   |

Les champs inconnus sont rejetés. Les IDs d’objets sont des nombres JavaScript entiers, sans conversion en entier SQL signé 32 bits. Un héros sans règles reçoit une réponse 422 plutôt qu’un build générique présenté comme personnalisé.

## Vérification

```bash
pnpm lint
pnpm audit --prod
pnpm format:check
pnpm typecheck
pnpm test
pnpm --filter @deadlock/api test:integration
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

Les tests d’intégration créent un schéma PostgreSQL isolé, y appliquent les migrations puis le suppriment. Ils utilisent des réponses source synthétiques, sans dépendance réseau. Les tests Playwright utilisent le catalogue présent dans la base locale et démarrent leurs propres applications compilées ; lancer un import réel au préalable et arrêter les serveurs occupant les ports 3000/3001 avant les tests. Ils refusent de réutiliser un serveur existant pour éviter de vérifier une ancienne compilation.

GitHub Actions utilise une base éphémère avec des fixtures explicitement synthétiques pour tester toute la chaîne hors ligne, y compris le partage et les états d’erreur, sur desktop et mobile. La commande de seed correspondante est restreinte à `CI=true`.

## Limites et suite du projet

1. Faire relire les quinze variantes par des joueurs expérimentés avant de les présenter comme des recommandations validées.
2. Faire relire les versions marquées `stale` après chaque nouveau client et documenter les décisions éditoriales.
3. Ajouter les intervalles de confiance et des seuils éditoriaux avant d’utiliser les performances des références pour modifier un ordre d’achat ; elles restent actuellement informatives.
4. Vérifier la disponibilité de la position de farm 1–6 et de la lane avant de comparer des profils ou de sélectionner une référence principale.
5. Relier les achats observés des comptes vérifiés aux versions éditoriales avant de présenter un build comme validé par une référence.
6. Ajouter favoris, comptes et éditeur personnel seulement après validation de ce premier parcours.

Avant une mise en production publique : vérifier les conditions de réutilisation des données et visuels, configurer HTTPS, sauvegardes/restauration, alertes d’import, limites de ressources et authentification de l’administration future. Le limiteur actuel est en mémoire, par processus et adresse IP (120 requêtes/minute par route). Derrière le proxy Next.js, les visiteurs partagent l’adresse du proxy : prévoir une stratégie d’identification de client fiable et un limiteur distribué avant de monter en charge. Ne pas faire confiance aux en-têtes transférés provenant de clients non fiables.

## Sources et attribution

- [Deadlock API](https://deadlock-api.com) : API communautaire, indépendante de Valve ; accès et disponibilité non garantis.
- [Documentation](https://api.deadlock-api.com/docs) et [code source de l’API](https://github.com/deadlock-api/deadlock-api).
- Les assets restent chargés depuis la source communautaire. Les noms, marques et visuels du jeu appartiennent à leurs ayants droit ; ce projet n’est pas affilié à Valve.

La licence du code de l’API externe ne constitue pas automatiquement une licence de réutilisation de tous les assets du jeu.

Les résolutions ciblées de `multer` et `deepmerge-ts` dans `pnpm-workspace.yaml` imposent les versions corrigées de leurs avis de sécurité. Réévaluer ces résolutions lors des mises à jour de NestJS et Prisma ; les migrations et les tests d’intégration couvrent leur compatibilité avec ce projet.
