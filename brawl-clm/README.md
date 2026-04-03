# Brawl Club Manager

Projet Next.js + Supabase pour gérer votre organisation Brawl Stars.

## À quoi sert le projet

Le projet centralise la gestion de vos clubs Prairie dans une seule interface staff :

- suivi des trophées de saison
- objectifs par club
- gros objectif et points
- vue joueurs
- vue clubs
- classements
- mode modération
- notes internes
- état actif / inactif
- logs admin
- import Brawl Stars
- synchronisation réelle des trophées

## Stack actuelle

### Front
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion
- Three.js
- Lucide React

### Back
- Supabase
- PostgreSQL
- SQL custom
- vues SQL pour les stats et classements
- routes API Next.js côté serveur
- intégration API Brawl Stars officielle

## Structure du projet

```text
brawl-clm/
├── app/
│   ├── api/
│   │   ├── brawl/sync/route.ts
│   │   ├── clubs/save/route.ts
│   │   ├── dashboard/route.ts
│   │   └── memberships/
│   │       ├── create/route.ts
│   │       ├── delete/route.ts
│   │       └── save/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── dashboard/
│   │   └── BrawlClubManagerApp.tsx
│   └── ui/
├── lib/
│   ├── brawl-stars/
│   │   ├── api.ts
│   │   └── sync.ts
│   ├── server/
│   │   └── dashboard.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── repository.ts
│   │   └── server.ts
│   └── utils.ts
├── sql/
│   ├── schema.sql
│   └── migrations/
│       └── 002_brawl_api_sync.sql
├── .env.example
├── package.json
└── README.md
```

## Ce qui marche actuellement

### Interface
- dashboard global
- fond animé
- vue joueurs
- vue clubs
- classement trophées
- classement points par club
- mode modération
- notes internes
- état actif / inactif
- ajout / suppression de membre

### Back réel
- chargement des clubs depuis Supabase via route serveur
- chargement des joueurs depuis Supabase via route serveur
- chargement des logs admin via route serveur
- sauvegarde d’un club via route serveur
- sauvegarde d’un membre via route serveur
- création d’un membre via route serveur
- suppression d’un membership via route serveur

### Brawl Stars
- bouton **Sync Brawl Stars** dans le front
- import des membres réels d’un club depuis l’API officielle Brawl Stars
- initialisation automatique des memberships manquants
- mise à jour réelle des trophées actuels via l’API
- mise à jour des rôles président / vice-président / membre selon l’API
- passage automatique en inactif des memberships absents du club remote
- log de sync enregistré dans `admin_logs`

## Ce qu’il faut configurer pour la sync Brawl Stars

### Variables d’environnement
Crée ou complète `.env.local` avec :

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
BRAWL_STARS_API_TOKEN=...
```

### À quoi elles servent
- `NEXT_PUBLIC_SUPABASE_URL` : URL du projet Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : clé publique pour le front
- `SUPABASE_SERVICE_ROLE_KEY` : clé serveur pour les routes API Next.js
- `BRAWL_STARS_API_TOKEN` : token API officiel Brawl Stars

## Important pour l’API Brawl Stars

L’API officielle Brawl Stars nécessite une clé API générée depuis le portail développeur officiel, et les requêtes utilisent des endpoints joueurs et clubs pour récupérer les profils et la liste des membres. citeturn911634view0

En pratique, pour que la sync marche, il faut :
- une clé API valide
- l’IP de ton environnement autorisée dans le portail Brawl Stars si nécessaire
- les vrais `club_tag` enregistrés dans la table `clubs`

## Ce qu’il faut faire dans Supabase

### 1. Schéma principal
Exécute `sql/schema.sql` si tu repars de zéro.

### 2. Migration Brawl API
Si ta base existe déjà, exécute aussi :

```sql
sql/migrations/002_brawl_api_sync.sql
```

Cette migration ajoute notamment :
- `clubs.club_tag`
- `persons.display_name`
- l’index unique corrigé sur `persons`

## Comment lancer le projet

```bash
npm install
npm run dev
```

Puis ouvre :

```text
http://localhost:3000
```

## Comment utiliser la sync Brawl Stars

### Étape 1
Renseigne les `club_tag` de tes clubs dans le mode modération.

### Étape 2
Vérifie que la saison active existe dans Supabase.

### Étape 3
Clique sur **Sync Brawl Stars**.

### Résultat attendu
La sync va :
- lire tous les clubs avec un `club_tag`
- récupérer leurs membres réels depuis Brawl Stars
- créer les personnes manquantes
- créer les memberships manquants dans la saison active
- mettre `trophies_end` avec les trophées actuels live
- garder `trophies_start` comme base de début de saison si déjà existant
- initialiser `trophies_start = trophies_end` pour les nouveaux membres
- marquer inactif un membership qui n’existe plus dans le club remote

## Ce qui ne marche pas encore complètement

### 1. Import historique des saisons passées
La sync actuelle remplit surtout la saison active.
Le back n’importe pas encore automatiquement l’historique des saisons antérieures depuis Brawl Stars.

### 2. Restauration admin backend complète
Les logs sont enregistrés, mais le restore automatique transactionnel backend n’est pas encore branché.

### 3. Export PDF / Excel
Toujours côté design uniquement.

### 4. Auth staff complète
Le schéma SQL prévoit les profils et rôles, mais le login staff complet n’est pas encore fini dans le front.

### 5. Rate limit / sync massive
La sync fait plusieurs appels API.
Si vous avez beaucoup de membres, il faudra peut-être ajouter plus tard :
- file d’attente
- batching
- sync planifiée
- retry automatique

## Pourquoi il y a encore parfois des écarts

Si tu vois encore des écarts, ça vient souvent de l’un de ces points :
- `club_tag` manquant
- token Brawl Stars absent ou invalide
- nouvelle personne pas encore importée
- trophées de début de saison pas initialisés comme tu veux
- saison active mal configurée dans Supabase

## Mode actuel du projet

Aujourd’hui, le projet est déjà une base sérieuse :
- le visuel est là
- la structure est là
- Supabase est branché
- la sync Brawl Stars est intégrée

Ce qu’il reste surtout pour une vraie prod solide :
- auth staff complète
- export
- gestion fine des saisons
- meilleure UX admin
- déploiement
