/**
 * api.js — Module API pour AnimeFlux
 * Sources : AniList (GraphQL) + Consumet (streaming)
 * Auteur  : Seydou | UTM Burkina Faso
 */

/* ============================================================
   ANILIST — Métadonnées & catalogue
   URL : https://graphql.anilist.co
   Doc : https://anilist.gitbook.io/anilist-apiv2-docs/
   ============================================================ */

const ANILIST_URL = 'https://graphql.anilist.co';

/** Champs communs retournés pour chaque animé */
const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { large extraLarge }
  bannerImage
  description
  episodes
  duration
  averageScore
  popularity
  status
  season
  seasonYear
  genres
  studios(isMain:true) { nodes { name } }
  nextAiringEpisode { episode airingAt }
`;

/** Exécute une requête GraphQL vers AniList */
async function queryAniList(query, variables = {}) {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

/* ---- Requêtes catalogue ---- */

export async function getTrending(page = 1, perPage = 20) {
  const q = `query($page:Int $perPage:Int){
    Page(page:$page perPage:$perPage){
      media(sort:TRENDING_DESC type:ANIME isAdult:false){ ${MEDIA_FIELDS} }
    }
  }`;
  const d = await queryAniList(q, { page, perPage });
  return d.Page.media;
}

export async function getTopRated(page = 1, perPage = 20) {
  const q = `query($page:Int $perPage:Int){
    Page(page:$page perPage:$perPage){
      media(sort:SCORE_DESC type:ANIME isAdult:false minimumTagRank:60){ ${MEDIA_FIELDS} }
    }
  }`;
  const d = await queryAniList(q, { page, perPage });
  return d.Page.media;
}

export async function searchAnime(search, page = 1, perPage = 20) {
  const q = `query($search:String $page:Int $perPage:Int){
    Page(page:$page perPage:$perPage){
      media(search:$search type:ANIME isAdult:false){ ${MEDIA_FIELDS} }
    }
  }`;
  const d = await queryAniList(q, { search, page, perPage });
  return d.Page.media;
}

export async function getByGenre(genre, page = 1, perPage = 20) {
  const q = `query($genre:String $page:Int $perPage:Int){
    Page(page:$page perPage:$perPage){
      media(genre:$genre sort:SCORE_DESC type:ANIME isAdult:false){ ${MEDIA_FIELDS} }
    }
  }`;
  const d = await queryAniList(q, { genre, page, perPage });
  return d.Page.media;
}

export async function getAnimeById(id) {
  const q = `query($id:Int){
    Media(id:$id type:ANIME){
      ${MEDIA_FIELDS}
      trailer { id site }
      characters(sort:ROLE perPage:6){
        nodes{ name{ full } image{ medium } }
      }
      relations{
        edges{
          relationType
          node{ id title{ romaji } coverImage{ large } type }
        }
      }
    }
  }`;
  const d = await queryAniList(q, { id });
  return d.Media;
}

/* ============================================================
   CONSUMET — Liens de streaming (gogoanime)
   Instances publiques disponibles :
     https://api.consumet.org   (officielle, parfois lente)
     https://consumet-api.onrender.com  (backup)
   Doc : https://docs.consumet.org
   ============================================================ */

const CONSUMET_BASES = [
  'https://api.consumet.org',
  'https://consumet-api.onrender.com',
];

/** Tente chaque base Consumet jusqu'à succès */
async function fetchConsumet(path) {
  for (const base of CONSUMET_BASES) {
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return await res.json();
    } catch (_) { /* essayer la suivante */ }
  }
  throw new Error('Tous les serveurs Consumet sont inaccessibles.');
}

/**
 * Recherche un animé sur Gogoanime via Consumet.
 * Retourne le premier résultat dont l'id gogoanime correspond.
 * @param {string} title - Titre romaji de l'animé
 */
export async function searchOnGogoanime(title) {
  const encoded = encodeURIComponent(title);
  const data = await fetchConsumet(`/anime/gogoanime/${encoded}`);
  return data.results || [];
}

/**
 * Récupère la liste des épisodes d'un animé gogoanime.
 * @param {string} gogoId - ID gogoanime (ex: "one-piece")
 */
export async function getEpisodes(gogoId) {
  const data = await fetchConsumet(`/anime/gogoanime/info/${gogoId}`);
  return data.episodes || [];
}

/**
 * Récupère les sources de streaming d'un épisode.
 * @param {string} episodeId - ID épisode gogoanime (ex: "one-piece-episode-1")
 * @returns {{ sources: Array<{url,quality,isM3U8}>, headers: object }}
 */
export async function getStreamingSources(episodeId) {
  const data = await fetchConsumet(`/anime/gogoanime/watch/${episodeId}`);
  return {
    sources: data.sources || [],
    headers: data.headers || {},
  };
}

/**
 * Pipeline complet : titre AniList → sources de streaming.
 * Gère automatiquement la correspondance AniList ↔ Gogoanime.
 * @param {string} title - Titre romaji
 * @param {number} epNum - Numéro de l'épisode (1-based)
 * @returns {{ sources, headers, episodeId }}
 */
export async function resolveStream(title, epNum) {
  /* 1. Rechercher l'animé sur Gogoanime */
  const results = await searchOnGogoanime(title);
  if (!results.length) throw new Error(`"${title}" introuvable sur Gogoanime.`);

  /* 2. Prendre le meilleur match (premier résultat) */
  const gogoId = results[0].id;

  /* 3. Récupérer la liste des épisodes */
  const episodes = await getEpisodes(gogoId);
  const episode = episodes.find(e => e.number === epNum) || episodes[epNum - 1];
  if (!episode) throw new Error(`Épisode ${epNum} introuvable.`);

  /* 4. Récupérer les sources */
  const { sources, headers } = await getStreamingSources(episode.id);

  return { sources, headers, episodeId: episode.id };
}
