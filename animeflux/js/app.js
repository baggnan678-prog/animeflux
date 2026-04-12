/**
 * app.js — Application principale AnimeFlux
 * Gestion des vues, navigation, modal, favoris
 * Auteur : Seydou | UTM Burkina Faso
 */

import {
  getTrending, getTopRated, searchAnime, getByGenre, getAnimeById
} from './api.js';
import { AnimePlayer } from './player.js';

/* ============================================================
   ÉTAT GLOBAL
   ============================================================ */

const state = {
  tab: 'home',
  favorites: JSON.parse(localStorage.getItem('animeflux_favs') || '[]'),
  cache: {},          // cache animé : id → objet complet
  player: null,       // instance AnimePlayer (créée à l'ouverture du modal)
  heroAnimes: [],
  heroIdx: 0,
  heroTimer: null,
};

const GENRES = [
  'Action', 'Adventure', 'Romance', 'Comedy', 'Fantasy',
  'Sci-Fi', 'Horror', 'Mystery', 'Sports', 'Slice of Life',
  'Psychological', 'Supernatural',
];

/* ============================================================
   FAVORIS
   ============================================================ */

function saveFavs() {
  localStorage.setItem('animeflux_favs', JSON.stringify(state.favorites));
}

function isFav(id) {
  return state.favorites.some(f => f.id === id);
}

function toggleFav(id) {
  if (isFav(id)) {
    state.favorites = state.favorites.filter(f => f.id !== id);
    toast('Retiré des favoris');
  } else {
    const anime = state.cache[id];
    if (anime) {
      state.favorites.push(anime);
      toast('❤️ Ajouté aux favoris');
    }
  }
  saveFavs();
  refreshFavBtn(id);
}

function refreshFavBtn(id) {
  const btn = document.getElementById(`fav-btn-${id}`);
  if (!btn) return;
  btn.textContent = isFav(id) ? '❤️' : '🤍';
  btn.classList.toggle('active', isFav(id));
}

/* ============================================================
   TOAST
   ============================================================ */

function toast(msg, duration = 2200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* ============================================================
   NAVIGATION
   ============================================================ */

window.switchTab = function(tab) {
  state.tab = tab;
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const btn = document.getElementById(`tab-${tab}`);
  if (btn) btn.classList.add('active');

  clearInterval(state.heroTimer);

  if (tab === 'home')  renderHome();
  if (tab === 'top')   renderTop();
  if (tab === 'fav')   renderFavPage();
};

window.goHome = () => window.switchTab('home');

window.handleSearchKey = (e) => { if (e.key === 'Enter') window.doSearch(); };

window.doSearch = () => {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  renderSearch(q);
};

/* ============================================================
   HERO CAROUSEL
   ============================================================ */

function buildHero(animes) {
  state.heroAnimes = animes.slice(0, 6);
  state.heroIdx = 0;
  renderHeroSlide();
  clearInterval(state.heroTimer);
  state.heroTimer = setInterval(() => {
    state.heroIdx = (state.heroIdx + 1) % state.heroAnimes.length;
    renderHeroSlide();
  }, 5000);
}

function renderHeroSlide() {
  const el = document.getElementById('hero-section');
  if (!el || !state.heroAnimes.length) return;

  const a    = state.heroAnimes[state.heroIdx];
  const title = a.title?.romaji || '';
  const desc  = (a.description || '').replace(/<[^>]*>/g, '').slice(0, 170);
  const bg    = a.bannerImage || a.coverImage?.large || '';
  const score = a.averageScore ? `⭐ ${(a.averageScore / 10).toFixed(1)}` : '';
  const ep    = a.episodes ? `${a.episodes} ep` : 'En cours';
  const cover = a.coverImage?.extraLarge || a.coverImage?.large || '';

  const dots = state.heroAnimes.map((_, i) =>
    `<button class="hero-dot${i === state.heroIdx ? ' active' : ''}" onclick="heroGo(${i})"></button>`
  ).join('');

  el.innerHTML = `
    <div class="hero-bg" style="background-image:url('${bg}')"></div>
    <div class="hero-overlay"></div>
    <div class="hero-overlay-bottom"></div>
    ${cover ? `<div class="hero-side-img"><img src="${cover}" alt="${title}" loading="lazy"/></div>` : ''}
    <div class="hero-content">
      <div class="hero-badge">✦ EN VEDETTE</div>
      <div class="hero-title">${title}</div>
      <div class="hero-meta">
        ${score ? `<span class="hero-meta-item">${score}</span>` : ''}
        ${ep    ? `<span class="hero-meta-item" style="color:var(--muted)">•</span>
                   <span class="hero-meta-item" style="color:var(--muted)">${ep}</span>` : ''}
        ${a.genres?.[0] ? `<span class="hero-meta-item" style="color:var(--muted)">•</span>
                            <span class="hero-meta-item" style="color:var(--muted)">${a.genres[0]}</span>` : ''}
      </div>
      <div class="hero-desc">${desc}</div>
      <div class="hero-buttons">
        <button class="btn-primary" onclick="openModal(${a.id})">▶ Regarder</button>
        <button class="btn-secondary" onclick="openModal(${a.id})">+ Infos</button>
      </div>
    </div>
    <div class="hero-indicators">${dots}</div>`;
}

window.heroGo = (i) => { state.heroIdx = i; renderHeroSlide(); };

/* ============================================================
   HELPERS HTML
   ============================================================ */

function skeletonGrid(n = 10) {
  return `<div class="anime-grid">${Array(n).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-img skeleton"></div>
      <div class="skeleton-line skeleton"></div>
      <div class="skeleton-short skeleton"></div>
    </div>`).join('')}</div>`;
}

function animeCard(a) {
  const title = a.title?.romaji || '???';
  const score = a.averageScore ? `⭐ ${(a.averageScore / 10).toFixed(1)}` : '';
  const ep    = a.episodes ? `${a.episodes} ep` : '';
  const img   = a.coverImage?.large;
  const isNew = a.status === 'RELEASING';

  return `
  <div class="anime-card" onclick="openModal(${a.id})">
    ${isNew ? '<span class="anime-card-tag">EN COURS</span>' : ''}
    ${img
      ? `<img class="anime-card-img" src="${img}" alt="${title}" loading="lazy"/>`
      : `<div class="anime-card-placeholder">🎬</div>`}
    <div class="anime-card-overlay"><div class="play-icon">▶</div></div>
    <div class="anime-card-body">
      <div class="anime-card-title">${title}</div>
      <div class="anime-card-foot">
        <span class="anime-score">${score}</span>
        <span class="anime-ep">${ep}</span>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   VUES PRINCIPALES
   ============================================================ */

async function renderHome() {
  const c = document.getElementById('content');
  c.innerHTML = `
    <div class="hero" id="hero-section"></div>
    <div class="section">
      <div class="section-header">
        <span class="section-title">Tendances</span>
      </div>
      <div id="trending-grid">${skeletonGrid(10)}</div>
    </div>
    <div class="section" style="padding-top:0">
      <div class="section-header"><span class="section-title">Genres</span></div>
      <div class="genre-pills">
        ${GENRES.map(g =>
          `<button class="genre-pill" onclick="filterGenre('${g}',this)">${g}</button>`
        ).join('')}
      </div>
    </div>`;

  try {
    const list = await getTrending(1, 20);
    buildHero(list);
    document.getElementById('trending-grid').innerHTML =
      `<div class="anime-grid">${list.map(animeCard).join('')}</div>`;
  } catch (e) {
    document.getElementById('trending-grid').innerHTML =
      `<div class="empty"><div class="empty-icon">⚠️</div>
       <h3>Erreur de chargement</h3>
       <p>Vérifiez votre connexion internet.</p></div>`;
  }
}

async function renderTop() {
  const c = document.getElementById('content');
  c.innerHTML = `
    <div class="section">
      <div class="section-header"><span class="section-title">Top Animés — Tous les temps</span></div>
      <div id="top-grid">${skeletonGrid(20)}</div>
    </div>`;
  try {
    const list = await getTopRated(1, 20);
    document.getElementById('top-grid').innerHTML =
      `<div class="anime-grid">${list.map(animeCard).join('')}</div>`;
  } catch (e) {
    document.getElementById('top-grid').innerHTML =
      `<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur de chargement.</p></div>`;
  }
}

async function renderSearch(q) {
  state.tab = '';
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  clearInterval(state.heroTimer);

  const c = document.getElementById('content');
  c.innerHTML = `
    <div class="results-bar">Résultats pour "<b>${q}</b>"</div>
    <div class="section"><div id="search-grid">${skeletonGrid(10)}</div></div>`;
  try {
    const list = await searchAnime(q);
    document.getElementById('search-grid').innerHTML = list.length
      ? `<div class="anime-grid">${list.map(animeCard).join('')}</div>`
      : `<div class="empty"><div class="empty-icon">🔍</div>
         <h3>Aucun résultat</h3><p>Aucun animé trouvé pour "${q}".</p></div>`;
  } catch (e) {}
}

function renderFavPage() {
  clearInterval(state.heroTimer);
  const c = document.getElementById('content');
  if (!state.favorites.length) {
    c.innerHTML = `<div class="empty" style="padding:80px 20px">
      <div class="empty-icon">🤍</div>
      <h3>Aucun favori</h3>
      <p>Ouvrez un animé et cliquez sur ❤️ pour l'ajouter.</p>
    </div>`;
    return;
  }
  c.innerHTML = `
    <div class="section">
      <div class="section-header">
        <span class="section-title">Mes Favoris (${state.favorites.length})</span>
      </div>
      <div class="anime-grid">${state.favorites.map(animeCard).join('')}</div>
    </div>`;
}

window.filterGenre = async (g, btn) => {
  document.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('trending-grid').innerHTML = skeletonGrid(10);
  try {
    const list = await getByGenre(g);
    document.getElementById('trending-grid').innerHTML =
      `<div class="anime-grid">${list.map(animeCard).join('')}</div>`;
  } catch (e) {}
};

/* ============================================================
   MODAL DÉTAIL + LECTEUR
   ============================================================ */

window.openModal = async (id) => {
  /* Charger les données si pas encore en cache */
  if (!state.cache[id]) {
    try {
      state.cache[id] = await getAnimeById(id);
    } catch (e) {
      toast('Erreur de chargement de la fiche.');
      return;
    }
  }
  renderModal(state.cache[id]);
};

function renderModal(a) {
  const old = document.getElementById('modal-overlay');
  if (old) old.remove();

  const title   = a.title?.romaji || a.title?.english || '???';
  const titleEn = a.title?.english || '';
  const desc    = (a.description || '').replace(/<[^>]*>/g, '').slice(0, 400);
  const score   = a.averageScore ? `⭐ ${(a.averageScore / 10).toFixed(1)}/10` : 'N/A';
  const ep      = a.episodes || '?';
  const status  = { FINISHED:'Terminé', RELEASING:'En cours', NOT_YET_RELEASED:'À venir' }[a.status] || a.status;
  const year    = a.seasonYear || '';
  const studio  = a.studios?.nodes?.[0]?.name || '';
  const genres  = (a.genres || []).slice(0, 6).map(g => `<span class="modal-tag">${g}</span>`).join('');
  const favIcon = isFav(a.id) ? '❤️' : '🤍';
  const img     = a.coverImage?.large;
  const maxEp   = Math.min(a.episodes || 13, 200);

  /* Construction des boutons d'épisodes par tranches de 50 */
  const ranges = [];
  for (let i = 0; i < maxEp; i += 50) {
    ranges.push({ from: i + 1, to: Math.min(i + 50, maxEp) });
  }

  const rangesHTML = ranges.length > 1
    ? ranges.map((r, i) =>
        `<button class="ep-range-btn${i === 0 ? ' active' : ''}"
                 onclick="showEpRange(${r.from},${r.to},'${encodeURIComponent(title)}',this)">
           ${r.from}–${r.to}
         </button>`).join('')
    : '';

  const firstRange = ranges[0] || { from: 1, to: maxEp };
  const epBtns = buildEpBtns(firstRange.from, firstRange.to, title);

  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close" onclick="closeModal()">✕</button>

      <!-- En-tête -->
      <div class="modal-hero">
        ${img
          ? `<div class="modal-poster"><img src="${img}" alt="${title}"/></div>`
          : `<div class="modal-poster-ph">🎬</div>`}
        <div class="modal-info">
          <div class="modal-title">${title}</div>
          ${titleEn && titleEn !== title ? `<div class="modal-subtitle">${titleEn}</div>` : ''}
          <div class="modal-badges">
            <span class="badge badge-score">${score}</span>
            <span class="badge badge-ep">${ep} épisodes</span>
            <span class="badge badge-status">${status}</span>
            ${year ? `<span class="badge badge-year">${year}</span>` : ''}
            ${studio ? `<span class="badge badge-ep">${studio}</span>` : ''}
            <button class="modal-fav-btn${isFav(a.id) ? ' active' : ''}"
                    id="fav-btn-${a.id}"
                    onclick="toggleFavModal(${a.id})">
              ${favIcon}
            </button>
          </div>
          <div class="modal-desc">${desc}</div>
          <div class="modal-tags">${genres}</div>
        </div>
      </div>

      <!-- Lecteur vidéo -->
      <div class="player-section">
        <div class="player-section-title">
          <div class="dot"></div> LECTEUR VIDÉO
        </div>
        <div class="video-wrapper" id="video-wrapper">
          <div id="player-state" style="display:flex">
            <p class="player-msg" style="font-size:14px;color:var(--muted)">
              Sélectionnez un épisode ci-dessous
            </p>
          </div>
        </div>
      </div>

      <!-- Épisodes -->
      <div class="episodes-section">
        <div class="player-section-title">ÉPISODES</div>
        <div class="ep-controls">
          ${rangesHTML
            ? `<span class="ep-range-label">Plage :</span>${rangesHTML}`
            : ''}
        </div>
        <div class="ep-grid" id="ep-grid">${epBtns}</div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  /* Initialiser le player */
  state.player = new AnimePlayer('video-wrapper', 'player-state');
}

function buildEpBtns(from, to, title) {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const num = from + i;
    const watched = state.player?.isWatched(title, num);
    return `<button class="ep-btn${watched ? ' watched' : ''}"
                    id="ep-${num}"
                    onclick="selectEp(${num},'${encodeURIComponent(title)}')">
              ${num}
            </button>`;
  }).join('');
}

window.showEpRange = (from, to, titleEnc, btn) => {
  document.querySelectorAll('.ep-range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const title = decodeURIComponent(titleEnc);
  document.getElementById('ep-grid').innerHTML = buildEpBtns(from, to, title);
};

window.selectEp = async (num, titleEnc) => {
  const title = decodeURIComponent(titleEnc);

  /* Mettre en évidence le bouton */
  document.querySelectorAll('.ep-btn').forEach(b => {
    b.classList.remove('active');
    if (parseInt(b.id.replace('ep-','')) === num) b.classList.add('active');
  });

  /* Scroller jusqu'au player */
  document.getElementById('video-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /* Lancer la lecture */
  if (state.player) {
    await state.player.load(title, num);
  }
};

window.closeModal = () => {
  const o = document.getElementById('modal-overlay');
  if (o) o.remove();
  if (state.player?.hls) state.player.hls.destroy();
  state.player = null;
};

window.toggleFavModal = (id) => toggleFav(id);

/* Fermer avec Escape */
document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeModal(); });

/* ============================================================
   INITIALISATION
   ============================================================ */
renderHome();
