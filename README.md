# Family Link Secret Santa

## Présentation
Family Link Secret Santa est une application complète permettant d'organiser un échange de cadeaux au sein d'une famille ou d'un groupe d'amis. Elle combine une API Node.js pour la gestion des comptes créateurs, des évènements et des participants, ainsi qu'une interface React moderne pour configurer pas à pas le tirage au sort, visualiser les informations clés et déclencher l'envoi des notifications.

## Prérequis
- **Node.js 18 ou supérieur** et **npm** pour exécuter les scripts du frontend et du backend.
- **SQLite 3** installé sur la machine (l'API s'appuie sur l'exécutable `sqlite3`).
- Facultatif : **nodemon** (`npm install -g nodemon`) si vous souhaitez recharger automatiquement l'API en développement.

## Installation
### Backend (API Node.js)
1. Depuis la racine du dépôt :
   ```bash
   cd app
   npm install
   ```
   Le projet n'utilise que des modules natifs, l'installation prépare surtout les scripts npm.

### Frontend (interface React)
1. Depuis la racine du dépôt :
   ```bash
   cd web
   npm install
   ```
   Les dépendances (React 19, Bootstrap empaqueté localement, Sass) sont fournies via les packages inclus dans le dossier `packages/`.
2. Toujours dans `web/`, copiez le fichier `.env.example` afin de créer votre configuration locale :
   ```bash
   cp .env.example .env
   ```
   Ajustez ensuite `REACT_APP_API_BASE_URL` si votre API tourne sur un autre hôte ou port.

## Lancement et scripts
### Backend
- **Développement** :
  ```bash
  cd app
  PORT=4000 npm start
  ```
  Par défaut l'API écoute sur le port `3000`. Fixer `PORT=4000` évite le conflit avec le serveur de développement React ; pensez alors à mettre à jour `REACT_APP_API_BASE_URL` dans votre `.env`.
- **Développement avec rechargement** (si `nodemon` est disponible) :
  ```bash
  cd app
  PORT=4000 npm run dev
  ```
- **Production** : `npm start` (avec les variables d'environnement adaptées).
- **Tests** : `npm test` (script de placeholder, aucun test automatisé n'est fourni pour l'instant).

### Frontend
- **Développement** :
  ```bash
  cd web
  npm start
  ```
  L'application est servie sur http://localhost:3000 avec rechargement à chaud.
- **Build de production** : `npm run build` génère une version optimisée dans `web/build`.
- **Tests** : `npm test` lance la suite de tests Create React App en mode interactif.

## Description fonctionnelle
- **Créateur d'évènement** : un utilisateur peut s'inscrire ou se connecter pour créer un Secret Santa, définir les détails (titre, date, budget, lieu) et conserver un tableau récapitulatif.
- **Gestion des participants** : l'interface wizard permet d'ajouter plusieurs participants (nom + email), de visualiser la liste et de confirmer avant validation. Les données sont persistées en base SQLite.
- **Tirage et notifications e-mail** : côté backend, un tirage aléatoire associe chaque participant à un destinataire unique. L'envoi d'e-mails est simulé par des logs structurés dans la console (les points d'extension permettent d'intégrer un service SMTP réel).
- **Mode sombre** : le frontend propose un commutateur clair/sombre. La préférence est mémorisée dans `localStorage` tout en respectant les préférences système.

## Variables d'environnement
| Variable | Portée | Valeur par défaut | Description |
| --- | --- | --- | --- |
| `PORT` | Backend | `3000` | Port HTTP de l'API. Vous pouvez utiliser `4000` pour éviter un conflit avec le frontend (mettez alors à jour `REACT_APP_API_BASE_URL`). |
| `JWT_SECRET` | Backend | `development-secret` | Secret utilisé pour signer les tokens JWT des créateurs. |
| `MAIL_SENDER` | Backend | `secret-santa@example.com` | Adresse d'expéditeur affichée dans les e-mails simulés. |
| `MAIL_SUBJECT` | Backend | `Votre tirage Secret Santa` | Sujet des notifications envoyées aux participants. |
| `REACT_APP_API_BASE_URL` | Frontend | `http://localhost:3000/api` | URL de base des appels REST. Ajustez-la si l'API tourne sur un autre hôte/port (par exemple `http://localhost:4000/api` si l'API écoute sur 4000). |

## Architecture
Le projet est structuré en deux sous-répertoires indépendants :
- `app/` contient une API HTTP Node.js minimaliste (sans Express) qui utilise les modules natifs, un routeur maison et une base SQLite. Les choix techniques favorisent la portabilité (pas de dépendances externes) tout en offrant les fonctionnalités essentielles : authentification JWT, persistance des évènements/participants et orchestration du tirage avec envoi d'e-mails (actuellement loggés en console).
- `web/` regroupe une application React créée avec Create React App. L'interface s'appuie sur Bootstrap stylé via Sass pour accélérer la mise en forme, proposer un design responsive et un thème sombre piloté par attribut `data-theme`. Les appels API transitent via `fetch` et les services définis dans `src/services/api.js`, garantissant une séparation claire entre logique métier backend et expérience utilisateur frontend.

Cette séparation nette facilite le déploiement indépendant : l'API peut être hébergée sur un serveur Node.js tandis que le frontend peut être servi en mode statique depuis n'importe quel hébergeur.
