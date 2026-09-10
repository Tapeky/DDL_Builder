# Deadlock / Atelier

Un premier site en français pour explorer le catalogue de Deadlock et préparer un parcours d’achat expliqué. Next.js sert l’interface ; NestJS porte les règles métier et les imports ; PostgreSQL conserve les versions du catalogue et les builds partagés.

**Ce n’est pas encore un moteur statistique ni un produit prêt pour une exploitation publique.** Les builds sont des brouillons expérimentaux non validés par des joueurs experts. Aucun taux de victoire n’est affiché ou inventé.

## Fonctionnalités de cette première version

- Import réel des héros jouables et des objets de boutique standards, en français, depuis Deadlock API.
- Version du client fixée avant les deux téléchargements, validation des données externes et publication atomique d’un catalogue immuable.
- Cinq héros couverts : Infernus, Seven, Abrams, Haze (Nébula en français) et Ivy (Lyanne en français).
- Trois orientations par héros : équilibrée, offensive et survie. Chaque parcours explique huit achats en trois phases.
- Déduction des composants déjà achetés, y compris les composants transitifs, sans double crédit.
- Catalogue filtrable par catégorie et nom, descriptions et composants consultables.
- Builds sauvegardés et partageables par URL : un nouvel import ne réécrit pas les anciens liens.
- Signalement explicite des données absentes ou non vérifiées depuis 24 heures ; un import échoué ne détruit pas le dernier catalogue valide.

Les objets spéciaux de niveau 5 sont exclus. Les versions importées sont des **versions du client**, pas des dates de patch vérifiées. La fraîcheur du catalogue ne vaut pas validation des builds pour la méta actuelle.

## Démarrage local

Prérequis : Node.js 24, pnpm 11.15.1, Docker avec Compose, et un accès sortant HTTPS à Deadlock API.

```bash
cp .env.example .env
```

Remplacer le mot de passe local dans `POSTGRES_PASSWORD` et dans `DATABASE_URL` par la même valeur. Utiliser une valeur URL-encodée dans l’URL si elle contient des caractères réservés. Ne jamais committer `.env`.

```bash
pnpm install
docker compose up -d --wait
pnpm db:generate
pnpm db:migrate
pnpm data:sync
pnpm dev
```

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

Cette livraison fournit une **commande manuelle**, pas encore un ordonnanceur. Une tâche planifiée exécutant `node apps/api/dist/sync.js` pourra l’appeler après compilation. Redis/BullMQ reste différé tant qu’il n’y a pas de traitement analytique ou de file de travaux à gérer.

## Structure

```text
apps/api/src/
  catalog/          Adaptateur externe, normalisation, import et lecture des snapshots
  recommendations/  Règles éditoriales, achats, sauvegarde et lecture des builds
  database.module.ts
apps/api/prisma/    Schéma PostgreSQL et migrations
apps/web/          Application Next.js responsive
packages/contracts/ Types des réponses et requêtes consommés par le frontend
tests/             Parcours Playwright sur l’API et le frontend réels
```

Le modèle initial stocke le catalogue normalisé en JSONB dans `CatalogSnapshot`, avec un pointeur `CatalogHead`, des `SavedBuild` immuables et des `SyncRun`. Il évite de créer prématurément un entrepôt de matchs. Les types partagés sont écrits à la main pour cette première tranche ; le client généré depuis OpenAPI reste à faire.

Les règles de départ sont dans `apps/api/src/recommendations/engine.ts`. Toute évolution métier doit incrémenter `ENGINE_VERSION` et ajouter des tests. Les anciens builds sauvegardés conservent leur payload, même après modification du moteur.

## API

| Route                                       | Fonction                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /v1/health`                            | Vérification du service et de PostgreSQL                                       |
| `GET /v1/catalog`                           | Héros, objets et état du catalogue courant                                     |
| `GET /v1/data-status`                       | Source, version, dates et fraîcheur                                            |
| `GET /v1/heroes?version=...`                | Héros d’une version importée                                                   |
| `GET /v1/items?version=...&category=spirit` | Objets et filtre de catégorie                                                  |
| `POST /v1/recommendations`                  | `{ "heroId": 1, "style": "balanced", "version": "..." }` ; version facultative |
| `GET /v1/builds/:id`                        | Payload immuable du build partagé                                              |

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
2. Ajouter une administration authentifiée, une validation éditoriale par patch et un suivi détaillé des changements d’objets.
3. Ajouter statistiques, échantillons et intervalles de confiance après validation de la couverture réelle de la source.
4. Étendre le contexte aux adversaires, à l’inventaire, au budget disponible et aux règles d’emplacements ; le moteur actuel génère uniquement un parcours complet de départ.
5. Ajouter favoris, comptes et éditeur personnel seulement après validation de ce premier parcours.

Avant une mise en production publique : vérifier les conditions de réutilisation des données et visuels, configurer HTTPS, sauvegardes/restauration, alertes d’import, limites de ressources et authentification de l’administration future. Le limiteur actuel est en mémoire, par processus et adresse IP (120 requêtes/minute par route). Derrière le proxy Next.js, les visiteurs partagent l’adresse du proxy : prévoir une stratégie d’identification de client fiable et un limiteur distribué avant de monter en charge. Ne pas faire confiance aux en-têtes transférés provenant de clients non fiables.

## Sources et attribution

- [Deadlock API](https://deadlock-api.com) : API communautaire, indépendante de Valve ; accès et disponibilité non garantis.
- [Documentation](https://api.deadlock-api.com/docs) et [code source de l’API](https://github.com/deadlock-api/deadlock-api).
- Les assets restent chargés depuis la source communautaire. Les noms, marques et visuels du jeu appartiennent à leurs ayants droit ; ce projet n’est pas affilié à Valve.

La licence du code de l’API externe ne constitue pas automatiquement une licence de réutilisation de tous les assets du jeu.

Les résolutions ciblées de `multer` et `deepmerge-ts` dans `pnpm-workspace.yaml` imposent les versions corrigées de leurs avis de sécurité. Réévaluer ces résolutions lors des mises à jour de NestJS et Prisma ; les migrations et les tests d’intégration couvrent leur compatibilité avec ce projet.
