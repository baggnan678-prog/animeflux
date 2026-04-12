/**
 * player.js — Lecteur vidéo intelligent pour AnimeFlux
 * Gestion HLS (m3u8) + MP4 direct + iFrame fallback
 * Auteur : Seydou | UTM Burkina Faso
 */

import { resolveStream } from './api.js';

/* ============================================================
   CONSTANTES
   ============================================================ */

/** Sources iFrame de secours (aucune installation requise) */
const IFRAME_SOURCES = [
  {
    name: 'Gogo HD',
    buildUrl: (title, ep) => {
      const slug = slugify(title);
      return `https://gogoanimehd.io/embed/${slug}-episode-${ep}`;
    },
  },
  {
    name: 'AniEmbed',
    buildUrl: (title, ep) => {
      const slug = slugify(title);
      return `https://s3taku.com/videos/${slug}-episode-${ep}`;
    },
  },
  {
    name: 'EmBtaku',
    buildUrl: (title, ep) => {
      const slug = slugify(title);
      return `https://embtaku.pro/videos/${slug}-episode-${ep}`;
    },
  },
];

/* ============================================================
   UTILITAIRES
   ============================================================ */

/** Convertit un titre en slug URL (kebab-case, ASCII) */
function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // supprimer accents
    .replace(/[^a-z0-9\s-]/g, '')      // caractères non-ASCII
    .trim()
    .replace(/\s+/g, '-');
}

/** Choisit la meilleure source selon la qualité */
function pickBestSource(sources) {
  const priority = ['1080p', '720p', '480p', '360p', 'default', 'backup'];
  for (const q of priority) {
    const src = sources.find(s => s.quality === q);
    if (src) return src;
  }
  return sources[0] || null;
}

/* ============================================================
   CLASSE PLAYER
   ============================================================ */

export class AnimePlayer {
  /**
   * @param {string} containerId - ID du div conteneur du player
   * @param {string} stateId     - ID du div d'état (spinner/message)
   */
  constructor(containerId, stateId) {
    this.container = document.getElementById(containerId);
    this.stateDiv  = document.getElementById(stateId);
    this.hls       = null;           // instance HLS.js
    this.videoEl   = null;           // élément <video>
    this.currentEp = null;           // { title, epNum }
    this.watched   = new Set(
      JSON.parse(localStorage.getItem('animeflux_watched') || '[]')
    );
  }

  /* ---- État visuel ---- */

  showState(msg, spinner = true) {
    if (!this.stateDiv) return;
    this.stateDiv.style.display = 'flex';
    this.stateDiv.innerHTML = `
      ${spinner ? '<div class="player-spinner"></div>' : ''}
      <p class="player-msg">${msg}</p>`;
  }

  hideState() {
    if (this.stateDiv) this.stateDiv.style.display = 'none';
  }

  /* ---- Chargement principal ---- */

  /**
   * Charge et joue un épisode.
   * Stratégie : Consumet (HLS/MP4) → iFrame fallback
   * @param {string} title  - Titre romaji de l'animé
   * @param {number} epNum  - Numéro d'épisode
   */
  async load(title, epNum) {
    this.currentEp = { title, epNum };
    this.showState(`Chargement de l'épisode ${epNum}…`);
    this._clearVideo();

    try {
      const { sources, headers } = await resolveStream(title, epNum);
      const best = pickBestSource(sources);
      if (!best) throw new Error('Aucune source valide retournée.');

      if (best.isM3U8) {
        await this._loadHLS(best.url, headers);
      } else {
        this._loadMP4(best.url);
      }

      this._markWatched(title, epNum);
    } catch (err) {
      console.warn('[AnimeFlux] Consumet indisponible, bascule iFrame:', err.message);
      this._loadIFrame(title, epNum, 0);
    }
  }

  /* ---- Lecteur HLS (m3u8) ---- */

  async _loadHLS(url, headers) {
    /* Charger HLS.js depuis CDN si pas encore présent */
    if (!window.Hls) {
      await this._loadScript('https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js');
    }

    const video = this._createVideoElement();

    if (window.Hls.isSupported()) {
      if (this.hls) this.hls.destroy();

      this.hls = new window.Hls({
        xhrSetup: (xhr) => {
          Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        },
      });

      this.hls.loadSource(url);
      this.hls.attachMedia(video);

      this.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        this.hideState();
        video.play().catch(() => {});
      });

      this.hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn('[AnimeFlux] Erreur HLS fatale, bascule iFrame');
          this._loadIFrame(this.currentEp.title, this.currentEp.epNum, 0);
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      /* Safari : HLS natif */
      video.src = url;
      video.addEventListener('loadedmetadata', () => { this.hideState(); video.play(); });
    } else {
      throw new Error('HLS non supporté par ce navigateur.');
    }
  }

  /* ---- Lecteur MP4 direct ---- */

  _loadMP4(url) {
    const video = this._createVideoElement();
    video.src = url;
    video.addEventListener('canplay', () => this.hideState(), { once: true });
    video.play().catch(() => {});
  }

  /* ---- Fallback iFrame ---- */

  _loadIFrame(title, epNum, sourceIdx) {
    if (sourceIdx >= IFRAME_SOURCES.length) {
      this._showError(title, epNum);
      return;
    }

    const src = IFRAME_SOURCES[sourceIdx];
    const url = src.buildUrl(title, epNum);

    this._clearVideo();
    this.hideState();

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allowFullscreen = true;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';

    this.container.appendChild(iframe);

    /* Bandeau de sélection de source */
    this._renderSourceBar(title, epNum, sourceIdx);
  }

  /* ---- Afficher erreur finale ---- */

  _showError(title, epNum) {
    this._clearVideo();
    this.showState(`
      <p style="font-size:14px;color:#f0f0f5;font-weight:700;margin-bottom:8px">
        Épisode ${epNum} — ${title}
      </p>
      <p style="font-size:12px;text-align:center;max-width:260px">
        Aucune source de streaming n'a pu être chargée.<br>
        Essayez un autre épisode ou revenez plus tard.
      </p>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;justify-content:center">
        <a href="https://gogoanime3.co/${slugify(title)}-episode-${epNum}"
           target="_blank"
           style="background:var(--accent);color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:700">
          Ouvrir sur Gogoanime ↗
        </a>
        <a href="https://zoro.to/search?keyword=${encodeURIComponent(title)}"
           target="_blank"
           style="background:var(--surface2);color:var(--muted);padding:8px 16px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:700;border:1px solid var(--border)">
          Chercher sur Zoro ↗
        </a>
      </div>`, false);
  }

  /* ---- Bandeau de sources ---- */

  _renderSourceBar(title, epNum, activeIdx) {
    let bar = document.getElementById('source-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'source-bar';
      bar.className = 'source-selector';
      this.container.parentElement.insertBefore(bar, this.container.nextSibling);
    }

    bar.innerHTML = '<span style="font-size:12px;color:var(--muted);font-weight:700;align-self:center">Source :</span>' +
      IFRAME_SOURCES.map((s, i) => `
        <button class="source-btn${i === activeIdx ? ' active' : ''}"
                onclick="window._player.switchSource(${i})">
          ${s.name}
        </button>`).join('');

    /* Exposer le player globalement pour les boutons inline */
    window._player = this;
  }

  switchSource(idx) {
    if (!this.currentEp) return;
    this._loadIFrame(this.currentEp.title, this.currentEp.epNum, idx);
    /* Re-rendre la bar pour mettre à jour l'actif */
    this._renderSourceBar(this.currentEp.title, this.currentEp.epNum, idx);
  }

  /* ---- Helpers internes ---- */

  _createVideoElement() {
    const video = document.createElement('video');
    video.controls = true;
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';
    this.container.appendChild(video);
    this.videoEl = video;
    return video;
  }

  _clearVideo() {
    /* Détruire HLS.js si actif */
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    /* Supprimer les éléments existants */
    while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
    /* Supprimer la barre de sources si présente */
    const bar = document.getElementById('source-bar');
    if (bar) bar.remove();
    this.videoEl = null;
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ---- Progression & historique ---- */

  _markWatched(title, epNum) {
    const key = `${title}::${epNum}`;
    this.watched.add(key);
    localStorage.setItem('animeflux_watched', JSON.stringify([...this.watched]));

    /* Mettre à jour l'UI si le bouton est visible */
    const btn = document.getElementById(`ep-${epNum}`);
    if (btn && !btn.classList.contains('active')) {
      btn.classList.add('watched');
    }
  }

  isWatched(title, epNum) {
    return this.watched.has(`${title}::${epNum}`);
  }
}
