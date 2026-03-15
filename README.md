# Geneasphere

Geneasphere est une application web full-stack permettant de créer, visualiser et gérer des arbres généalogiques de manière interactive.

🔗 **Lien de l’application :** [Accéder à l’application](https://genea-sphere-seven.vercel.app/login)

## Accès démo

Pour faciliter l’évaluation du projet, un compte de démonstration avec des données préchargées est disponible :

- **Email :** admin@geneasphere.test
- **Mot de passe :** demo2026

## Fonctionnalités principales

- création et gestion d’arbres généalogiques
- ajout, modification et suppression de membres
- visualisation des relations familiales
- authentification utilisateur sécurisée
- validation des données côté client et côté serveur

## Stack technique

- **Front-end :** Next.js, React, TypeScript
- **Back-end :** API Routes Next.js, Node.js
- **Base de données :** MongoDB avec Mongoose
- **Authentification & sécurité :** JWT, Bcrypt
- **Validation des données :** Zod
- **Tests :** Jest, React Testing Library, MongoDB Memory Server
- **Qualité de code :** ESLint

## Architecture du projet

Le code source principal est centralisé dans le répertoire `src/`, avec l’alias `@/*` pour simplifier les imports.  
L’application s’appuie sur la structure de Next.js pour le routage, le rendu et la création des API.

## Installation en local

1. **Cloner le dépôt**
```bash
git clone [URL_DU_DEPOT_GITHUB]
cd geneasphere
````

2. **Installer les dépendances**

```bash
npm install
```

3. **Configurer les variables d’environnement**
   Créer un fichier `.env.local` à la racine du projet :

```env
MONGODB_URI=votre_chaine_de_connexion_mongodb
JWT_SECRET=votre_cle_secrete_jwt
```

4. **Lancer le serveur de développement**

```bash
npm run dev
```

L’application sera accessible sur `http://localhost:3000`.

## Tests

Le projet inclut des tests unitaires et d’intégration. Pour les lancer :

```bash
npm run test
```

## Objectif du projet

Ce projet m’a permis de renforcer mes compétences en développement full-stack, en authentification sécurisée, en modélisation de données avec MongoDB et en structuration d’une application web moderne avec Next.js.

