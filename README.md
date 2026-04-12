# 🎬 AnimeFlux

**Site de streaming d'animés — sans base de données**
Projet réalisé par **Seydou** | Génie Logiciel — UTM Burkina Faso

---

## 📁 Structure du projet

```
animeflux/
├── index.html          ← Point d'entrée principal
├── css/
│   └── style.css       ← Tous les styles (thème sombre, responsive)
├── js/
│   ├── api.js          ← Requêtes AniList (GraphQL) + Consumet (streaming)
│   ├── player.js       ← Lecteur vidéo : HLS.js → MP4 → iFrame fallback
│   └── app.js          ← Application : navigation, modal, favoris, hero
└── README.md           ← Ce fichier
```

---

## 🚀 Lancer le projet en local

> ⚠️ Les modules ES6 (`import/export`) nécessitent un serveur HTTP.
> **Ne pas ouvrir `index.html` directement** avec `file://` — les modules seront bloqués.

### Option 1 — VS Code Live Server (recommandé)
1. Installer l'extension **Live Server** dans VS Code
2. Clic droit sur `index.html` → **Open with Live Server**

### Option 2 — Python (si installé)
```bash
cd animeflux
python3 -m http.server 8000
# Ouvrir http://localhost:8000
```

### Option 3 — Node.js (npx serve)
```bash
cd animeflux
npx serve .
```

### Option 4 — Termux (Samsung Galaxy S24 Ultra)
```bash
pkg install python
cd ~/animeflux
python3 -m http.server 8080
# Ouvrir http://localhost:8080 dans le navigateur
```

---

## 🌐 Déployer en ligne (gratuit)

### Netlify (recommandé — le plus simple)
1. Créer un compte sur https://netlify.com
2. Glisser-déposer le dossier `animeflux/` sur le dashboard
3. URL générée automatiquement en 30 secondes ✅

### Vercel
```bash
npm install -g vercel
cd animeflux
vercel --prod
```

### GitHub Pages
```bash
git init
git add .
git commit -m "AnimeFlux v1.0"
git remote add origin https://github.com/VOTRE_USERNAME/animeflux.git
git push -u origin main
# Activer Pages dans Settings → Pages → Branch: main
```

---

## 🔌 APIs utilisées

### 1. AniList (GraphQL)
- **URL** : `https://graphql.anilist.co`
- **Auth** : Aucune (API publique)
- **Usage** : Catalogue, recherche, fiches détaillées, métadonnées
- **Doc**  : https://anilist.gitbook.io/anilist-apiv2-docs/

### 2. Consumet (Gogoanime)
- **URL principale** : `https://api.consumet.org`
- **URL de secours**  : `https://consumet-api.onrender.com`
- **Auth** : Aucune
- **Usage** : Liste d'épisodes + liens de streaming (HLS/MP4)
- **Doc**  : https://docs.consumet.org
- **⚠️ Note** : L'instance publique peut être lente ou hors ligne.
  Pour une utilisation en production, hébergez votre propre instance :
  ```bash
  git clone https://github.com/consumet/consumet.ts
  cd consumet.ts && npm install && npm start
  ```

---

## 🎥 Stratégie de lecture vidéo (player.js)

Le lecteur utilise une cascade de 3 niveaux :

```
1. Consumet API → sources HLS (m3u8) ou MP4 directes
        ↓ (si échec)
2. iFrame — Gogo HD  (embtaku/s3taku)
        ↓ (si échec)
3. iFrame — AniEmbed / EmBtaku
        ↓ (si tout échoue)
4. Liens directs vers Gogoanime / Zoro.to
```

**HLS.js** est chargé dynamiquement depuis CDN seulement si nécessaire.

---

## 💾 Stockage local (localStorage)

| Clé                   | Contenu                              |
|-----------------------|--------------------------------------|
| `animeflux_favs`      | Tableau JSON des animés favoris      |
| `animeflux_watched`   | Set des épisodes regardés (titre::ep)|

---

## 🛠️ Améliorations possibles (roadmap)

| Priorité | Fonctionnalité                                              |
|----------|-------------------------------------------------------------|
| 🔴 Haute | Self-host Consumet API (Railway / Render gratuit)           |
| 🔴 Haute | Ajouter un proxy CORS si les iFrames sont bloquées          |
| 🟡 Moyenne | Comptes utilisateurs (Firebase Auth ou Supabase)          |
| 🟡 Moyenne | Commentaires par épisode (Firebase Firestore)             |
| 🟢 Basse | PWA (manifest.json + Service Worker pour cache offline)     |
| 🟢 Basse | Mode sombre/clair toggle                                    |
| 🟢 Basse | Sous-titres (fichiers .vtt via AniList ou OpenSubtitles)    |

---

## 📝 Notes techniques

- **Aucun framework** : HTML/CSS/JS vanilla avec modules ES6 natifs
- **Aucune base de données** : tout est statique + APIs externes
- **Compatible** : Chrome, Firefox, Edge, Safari (iOS/Android)
- **Responsive** : mobile-first, testé sur S24 Ultra

---

*Projet éducatif — UTM Burkina Faso, 2025*
