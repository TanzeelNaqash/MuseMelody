import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuthRoutes, authenticateToken, authenticateWithGuest } from "./authRoutes";
import multer from "multer";
import path from "path";
import { mkdirSync, existsSync } from "fs";
import { resolveBestAudioUrl, clearResolvedStreamCache } from "./streamResolver";
import { request } from "undici";
import { Readable } from "stream";
import { uma } from './umaManager';
import http from "http";
import https from "https";

const LYRICS_API_URL = "https://api.lyrics.ovh/v1";

const DEFAULT_REGION = process.env.MUSIC_REGION ?? "IN";
const TRENDING_QUERIES: Array<{ query: string; weight: number }> = [
  { query: "trending songs 2025", weight: 1 },
  { query: "viral songs", weight: 0.96 },
  { query: "new hindi songs 2025", weight: 0.92 },
  { query: "punjabi hits 2025", weight: 0.9 },
  { query: "english hit songs 2025", weight: 0.88 },
  { query: "bollywood trending songs", weight: 0.86 },
];

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

// Map YouTube itag to MIME type for audio streams
// This global function is the correct one to use
function getMimeTypeFromItag(itag: string | null): string {
  if (!itag) return 'audio/webm'; 
  
  const itagNum = parseInt(itag, 10);
  
  const audioItags: Record<number, string> = {
    // MP4/AAC (Safari/iOS prefers this)
    140: 'audio/mp4', 141: 'audio/mp4', 256: 'audio/mp4', 258: 'audio/mp4',
    // WebM/Opus (Chrome/Android prefers this)
    249: 'audio/webm', 250: 'audio/webm', 251: 'audio/webm', 171: 'audio/webm', 172: 'audio/webm',
  };
  
  // If it's a known audio itag, return audio mime. Otherwise assume video.
  return audioItags[itagNum] || 'video/mp4'; 
}

function parseYouTubeId(value: string | undefined | null): string | null {
  if (!value) return null;
  if (YOUTUBE_ID_REGEX.test(value)) return value;

  let urlCandidate = value;
  if (value.startsWith('/')) {
    urlCandidate = `https://www.youtube.com${value}`;
  } else if (!/^https?:\/\//i.test(value)) {
    urlCandidate = `https://www.youtube.com/watch?v=${value}`;
  }

  try {
    const url = new URL(urlCandidate);
    const v = url.searchParams.get('v');
    if (v && YOUTUBE_ID_REGEX.test(v)) return v;

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      if (segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'v') {
        const maybeId = segments[1];
        if (YOUTUBE_ID_REGEX.test(maybeId)) return maybeId;
      }
    }

    if (segments.length === 1 && YOUTUBE_ID_REGEX.test(segments[0])) {
      return segments[0];
    }
  } catch {
    return null;
  }

  return null;
}

function extractVideoId(item: any): string | null {
  if (!item) return null;
  const candidates: Array<string | undefined> = [
    typeof item === 'string' ? item : undefined,
    item?.id,
    item?.videoId,
    item?.video_id,
    item?.url,
    item?.originalUrl,
  ];

  for (const candidate of candidates) {
    const id = parseYouTubeId(candidate);
    if (id) return id;
  }

  return null;
}

function pickThumbnail(item: any): string | undefined {
  if (!item) return undefined;
  if (typeof item.thumbnail === 'string') return item.thumbnail;
  if (typeof item.thumbnailUrl === 'string') return item.thumbnailUrl;
  if (typeof item.thumbnailUrl === 'object' && typeof item.thumbnailUrl?.url === 'string') {
    return item.thumbnailUrl.url;
  }
  if (Array.isArray(item?.thumbnails)) {
    const best = item.thumbnails.find((thumb: any) => thumb?.quality === 'maxres') ?? item.thumbnails[0];
    if (best?.url) return best.url;
  }
  if (Array.isArray(item?.videoThumbnails)) {
    const best = item.videoThumbnails.find((thumb: any) => thumb?.quality === 'maxres') ?? item.videoThumbnails[0];
    if (best?.url) return best.url;
  }
  return undefined;
}

function normalizeDuration(item: any): number {
  const candidates = [
    item?.duration,
    item?.lengthSeconds,
    item?.durationSeconds,
    item?.seconds,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && candidate > 0) return candidate;
    const parsed = parseInt(candidate as string, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function mapItemToTrack(
  item: any,
  options?: { source?: 'piped' | 'invidious'; instance?: string | null },
) {
  const id = extractVideoId(item);
  if (!id) return null;

  const title = item?.title ?? item?.name ?? 'Unknown Title';
  const artist =
    item?.uploaderName ??
    item?.author ??
    item?.channelName ??
    item?.uploader ??
    'Unknown Artist';

  return {
    id,
    youtubeId: id,
    title,
    artist,
    thumbnail: pickThumbnail(item),
    duration: normalizeDuration(item),
    source: 'youtube' as const,
    streamSource: options?.source,
    streamInstance: options?.instance,
  };
}

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!existsSync(uploadDir)) {
  try {
    mkdirSync(uploadDir, { recursive: true });
  } catch (error) {
    console.error("Failed to ensure uploads directory exists:", error);
  }
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuthRoutes(app);

  // Health check route (public)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });


  // Search from Piped (no YouTube API)
  app.get('/api/search', authenticateWithGuest, async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json([]);

    const region = String(req.query.region || DEFAULT_REGION);

    const pipedPromise = uma
      .fetchJson<any>(
        'piped',
        (base) =>
          `${base}/search?q=${encodeURIComponent(q)}&region=${encodeURIComponent(region)}&filter=videos`,
        { strictStatus: true },
        {
          cacheKey: `search:${region}:${q.toLowerCase()}`,
          ttlMs: 1000 * 30,
        },
      )
      .then((data) => {
        const instance = uma.getLastSuccessfulInstance('piped');
        if (instance) {
          console.log('[SEARCH] Piped instance used:', instance);
        }
        const items: any[] = Array.isArray(data?.items) ? data.items : [];
        return items
          .filter((item) => !item?.isShort)
          .map((item) => {
            const id =
              typeof item?.url === 'string'
                ? new URL('https://x' + item.url).searchParams.get('v') || item.url
                : item?.url;
            const duration = typeof item?.duration === 'number' && item.duration > 0 ? item.duration : 0;
            return {
              id,
              title: item?.title ?? 'Unknown Title',
              artist: item?.uploaderName ?? 'Unknown Artist',
              thumbnailUrl: item?.thumbnail ?? undefined,
              duration,
              isVideo: true,
              streamSource: 'piped' as const,
              streamInstance: instance,
            };
          });
      });

    const invidiousPromise = uma
      .fetchJson<any[]>(
        'invidious',
        (base) =>
          `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video&region=${encodeURIComponent(region)}`,
        { strictStatus: true },
        {
          cacheKey: `invidious-search:${region}:${q.toLowerCase()}`,
          ttlMs: 1000 * 45,
        },
      )
      .then((items) => {
        const instance = uma.getLastSuccessfulInstance('invidious');
        if (instance) {
          console.log('[SEARCH] Invidious instance used:', instance);
        }
        return (items ?? [])
        .filter((item: any) => {
          const duration = item?.lengthSeconds ?? 0;
          return duration === 0 || duration >= 20; // allow short OSTs & trending
        })
        
          .map((item: any) => {
            const thumbnail = Array.isArray(item?.videoThumbnails)
              ? item.videoThumbnails.find((thumb: any) => thumb?.quality === 'maxres')?.url ||
                item.videoThumbnails[0]?.url
              : undefined;
            return {
              id: item?.videoId,
              title: item?.title ?? 'Unknown Title',
              artist: item?.author ?? 'Unknown Artist',
              thumbnailUrl: thumbnail,
              duration: item?.lengthSeconds ?? 0,
              isVideo: true,
              streamSource: 'invidious' as const,
              streamInstance: instance,
            };
          });
      })
      .catch((error) => {
        console.error('Invidious supplemental search failed:', error);
        return [];
      });

    const [pipedResult, invidiousResult] = await Promise.allSettled([pipedPromise, invidiousPromise]);

    if (pipedResult.status === 'rejected' && invidiousResult.status === 'rejected') {
      console.error('Both Piped and Invidious searches failed:', pipedResult.reason, invidiousResult.reason);
      return res.status(500).json([]);
    }

    const combined: Array<{
      id: string;
      title: string;
      artist: string;
      thumbnailUrl?: string;
      duration: number;
      isVideo: boolean;
    }> = [];
    const seen = new Set<string>();
    const appendUnique = (items: typeof combined | undefined) => {
      if (!items) return;
      for (const item of items) {
        const key = item?.id;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        combined.push(item);
      }
    };

    appendUnique(pipedResult.status === 'fulfilled' ? pipedResult.value : undefined);
    appendUnique(invidiousResult.status === 'fulfilled' ? invidiousResult.value : undefined);

    res.json(combined.slice(0, 60));
  });

  // Fetch YouTube playlist tracks
  app.get('/api/youtube-playlist/:id', authenticateWithGuest, async (req, res) => {
    const playlistId = req.params.id;
    if (!playlistId) return res.status(400).json({ message: 'Playlist ID is required' });

    try {
      // Try Piped first
      const pipedResult = await uma
        .fetchJson<any>(
          'piped',
          (base) => `${base}/playlists/${encodeURIComponent(playlistId)}`,
          { strictStatus: true },
          {
            cacheKey: `Youtubelist:${playlistId}`,
            ttlMs: 1000 * 60 * 30,
          },
        )
        .then((data) => {
          const instance = uma.getLastSuccessfulInstance('piped');
          if (instance) {
            console.log('[YOUTUBE-PLAYLIST] Piped instance used:', instance);
          }
          const videos: any[] = Array.isArray(data?.relatedStreams) ? data.relatedStreams : [];
          return videos.map((video) => ({
            id: video?.url?.split('/').pop() || video?.url,
            title: video?.title ?? 'Unknown Title',
            artist: video?.uploaderName ?? 'Unknown Artist',
            thumbnailUrl: video?.thumbnail ?? undefined,
            duration: video?.duration ?? 0,
          }));
        })
        .catch((error) => {
          console.error('[YOUTUBE-PLAYLIST] Piped fetch failed:', error);
          return null;
        });

      if (pipedResult) {
        return res.json(pipedResult);
      }

      // Fallback to Invidious
      const invidiousResult = await uma
        .fetchJson<any>(
          'invidious',
          (base) => `${base}/api/v1/playlists/${encodeURIComponent(playlistId)}`,
          { strictStatus: true },
          {
            cacheKey: `Youtubelist-invidious:${playlistId}`,
            ttlMs: 1000 * 60 * 30,
          },
        )
        .then((data) => {
          const instance = uma.getLastSuccessfulInstance('invidious');
          if (instance) {
            console.log('[YOUTUBE-PLAYLIST] Invidious instance used:', instance);
          }
          const videos: any[] = Array.isArray(data?.videos) ? data.videos : [];
          return videos.map((video) => ({
            id: video?.videoId,
            title: video?.title ?? 'Unknown Title',
            artist: video?.author ?? 'Unknown Artist',
            thumbnailUrl: Array.isArray(video?.videoThumbnails)
              ? video.videoThumbnails.find((thumb: any) => thumb?.quality === 'medium')?.url ||
                video.videoThumbnails[0]?.url
              : undefined,
            duration: video?.lengthSeconds ?? 0,
          }));
        })
        .catch((error) => {
          console.error('[YOUTUBE-PLAYLIST] Invidious fetch failed:', error);
          return null;
        });

      if (invidiousResult) {
        return res.json(invidiousResult);
      }

      res.status(404).json({ message: 'Playlist not found' });
    } catch (error) {
      console.error('[YOUTUBE-PLAYLIST] Error:', error);
      res.status(500).json({ message: 'Failed to fetch playlist' });
    }
  });

// Featured playlist endpoint - get a single playlist by search query with tracks
app.get('/api/featured-playlist', authenticateWithGuest, async (req, res) => {
  const query = String(req.query.query || '').trim();
  if (!query) return res.status(400).json({ message: 'Query is required' });

  const region = String(req.query.region || DEFAULT_REGION);

  try {
    // Try Piped first (supports playlist search)
    const pipedResult = await uma
      .fetchJson<any>(
        'piped',
        (base) =>
          `${base}/search?q=${encodeURIComponent(query)}&region=${encodeURIComponent(region)}&filter=playlists`,
        { strictStatus: true },
        {
          cacheKey: `featured-playlist:${region}:${query}`,
          ttlMs: 1000 * 60 * 30, // Cache for 30 minutes
        },
      )
      .then(async (data) => {
        const instance = uma.getLastSuccessfulInstance('piped');
        if (instance) {
          console.log('[FEATURED-PLAYLIST] Piped instance used:', instance);
        }
        const items: any[] = Array.isArray(data?.items) ? data.items : [];
        const firstPlaylist = items[0];
        
        if (!firstPlaylist) {
          return null;
        }

        // Extract playlist ID from URL - handle formats like:
        // "/playlist?list=PLxxx" or "playlist?list=PLxxx" or just "PLxxx"
        let playlistId: string | null = null;
        if (typeof firstPlaylist?.url === 'string') {
          const url = firstPlaylist.url;
          // Try to extract from query parameter
          const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
          if (listMatch) {
            playlistId = listMatch[1];
          } else {
            // Fallback to last path segment
            playlistId = url.split('/').pop() || null;
            // Remove query string if present
            if (playlistId && playlistId.includes('?')) {
              playlistId = playlistId.split('?')[0];
            }
          }
        } else if (firstPlaylist?.url) {
          playlistId = String(firstPlaylist.url);
        }
        
        if (!playlistId || playlistId.startsWith('channel-')) {
          return {
            id: playlistId || 'unknown',
            title: firstPlaylist?.title ?? 'Unknown Playlist',
            description: firstPlaylist?.description ?? '',
            thumbnailUrl: firstPlaylist?.thumbnail ?? undefined,
            uploaderName: firstPlaylist?.uploaderName ?? 'Unknown',
            tracks: [],
          };
        }

        // Fetch playlist tracks
        try {
          const playlistData = await uma.fetchJson<any>(
            'piped',
            (base) => `${base}/playlists/${encodeURIComponent(playlistId!)}`,
            { strictStatus: false },
            {
              cacheKey: `playlist-tracks:${playlistId}`,
              ttlMs: 1000 * 60 * 30,
            },
          );

          // Get playlist info from the actual playlist data
          const playlistTitle = playlistData?.name || playlistData?.title || firstPlaylist?.title || 'Unknown Playlist';
          const playlistDescription = playlistData?.description || firstPlaylist?.description || '';
          
          // Get best quality playlist thumbnail
          let playlistThumbnail: string | undefined = undefined;
          if (playlistData?.thumbnailUrl) {
            playlistThumbnail = playlistData.thumbnailUrl;
          } else if (playlistData?.thumbnail) {
            playlistThumbnail = playlistData.thumbnail;
          } else if (Array.isArray(playlistData?.thumbnails)) {
            const bestThumb = playlistData.thumbnails.find((thumb: any) => thumb?.quality === 'maxres')
              || playlistData.thumbnails.find((thumb: any) => thumb?.quality === 'high')
              || playlistData.thumbnails[0];
            playlistThumbnail = bestThumb?.url || bestThumb;
          } else if (firstPlaylist?.thumbnail) {
            playlistThumbnail = firstPlaylist.thumbnail;
          }
          const playlistUploader = playlistData?.uploaderName || playlistData?.uploader || firstPlaylist?.uploaderName || 'Unknown';

          const videos: any[] = Array.isArray(playlistData?.relatedStreams) ? playlistData.relatedStreams : [];
          const tracks = videos.slice(0, 100).map((video) => {
            // --- FIX 1: Extract clean Video ID ---
            let videoId = video?.url;
            if (typeof videoId === 'string' && videoId.includes('v=')) {
                videoId = videoId.split('v=')[1].split('&')[0];
            } else if (typeof videoId === 'string') {
                videoId = videoId.split('/').pop();
            }
            // -------------------------------------
            
            // Get best quality thumbnail
            let thumbnail: string | undefined = undefined;
            if (video?.thumbnail) {
              thumbnail = video.thumbnail;
            } else if (Array.isArray(video?.thumbnails)) {
              // Find best quality thumbnail
              const bestThumb = video.thumbnails.find((thumb: any) => thumb?.quality === 'maxres') 
                || video.thumbnails.find((thumb: any) => thumb?.quality === 'high') 
                || video.thumbnails.find((thumb: any) => thumb?.quality === 'medium')
                || video.thumbnails[0];
              thumbnail = bestThumb?.url || bestThumb;
            }
            
            return {
              id: videoId,
              youtubeId: videoId,
              title: video?.title ?? 'Unknown Title',
              artist: video?.uploaderName ?? video?.uploader ?? 'Unknown Artist',
              thumbnail: thumbnail,
              duration: typeof video?.duration === 'number' ? video.duration : (typeof video?.duration === 'string' ? parseInt(video.duration, 10) : 0),
              source: 'youtube' as const,
            };
          });

          // Fallback to first track thumbnail if available
          if (!playlistThumbnail && tracks.length > 0 && tracks[0]?.thumbnail) {
            playlistThumbnail = tracks[0].thumbnail;
          }

          return {
            id: playlistId,
            title: playlistTitle,
            description: playlistDescription,
            thumbnailUrl: playlistThumbnail || tracks[0]?.thumbnail || undefined,
            uploaderName: playlistUploader,
            tracks,
          };
        } catch (error) {
          console.warn(`[FEATURED-PLAYLIST] Failed to fetch tracks for playlist ${playlistId}:`, error);
          return {
            id: playlistId,
            title: firstPlaylist?.title ?? 'Unknown Playlist',
            description: firstPlaylist?.description ?? '',
            thumbnailUrl: firstPlaylist?.thumbnail ?? undefined,
            uploaderName: firstPlaylist?.uploaderName ?? 'Unknown',
            tracks: [],
          };
        }
      })
      .catch((error) => {
        console.error('[FEATURED-PLAYLIST] Piped search failed:', error);
        return null;
      });

    // Fallback to Invidious (search for videos and create playlist-like result)
    if (!pipedResult) {
      const invidiousResult = await uma
        .fetchJson<any[]>(
          'invidious',
          (base) =>
            `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&region=${encodeURIComponent(region)}`,
          { strictStatus: true },
          {
            cacheKey: `featured-playlist-invidious:${region}:${query}`,
            ttlMs: 1000 * 60 * 30,
          },
        )
        .then((items) => {
          const instance = uma.getLastSuccessfulInstance('invidious');
          if (instance) {
            console.log('[FEATURED-PLAYLIST] Invidious instance used:', instance);
          }
          
          if (!items || items.length === 0) {
            return null;
          }

          // Take first 50 videos and create a playlist
          const videos = items.slice(0, 50);
          const firstVideo = videos[0];
          const thumbnail = Array.isArray(firstVideo?.videoThumbnails)
            ? firstVideo.videoThumbnails.find((thumb: any) => thumb?.quality === 'maxres')?.url ||
              firstVideo.videoThumbnails[0]?.url
            : undefined;
          
          const tracks = videos.map((v: any) => {
            // Get best quality thumbnail
            let thumbnail: string | undefined = undefined;
            if (Array.isArray(v?.videoThumbnails)) {
              const bestThumb = v.videoThumbnails.find((thumb: any) => thumb?.quality === 'maxres')
                || v.videoThumbnails.find((thumb: any) => thumb?.quality === 'high')
                || v.videoThumbnails.find((thumb: any) => thumb?.quality === 'medium')
                || v.videoThumbnails[0];
              thumbnail = bestThumb?.url;
            }
            
            return {
              id: v.videoId,
              youtubeId: v.videoId,
              title: v.title ?? 'Unknown Title',
              artist: v.author ?? 'Unknown Artist',
              thumbnail: thumbnail,
              duration: v.lengthSeconds ?? 0,
              source: 'youtube' as const,
            };
          });

          return {
            id: `search-${query}`,
            title: query,
            description: `${videos.length} tracks`,
            thumbnailUrl: thumbnail || tracks[0]?.thumbnail,
            uploaderName: firstVideo?.author ?? 'Unknown',
            tracks,
          };
        })
        .catch((error) => {
          console.error('[FEATURED-PLAYLIST] Invidious search failed:', error);
          return null;
        });

      if (invidiousResult) {
        return res.json(invidiousResult);
      }
    }

    if (pipedResult) {
      return res.json(pipedResult);
    }

    res.status(404).json({ message: 'Playlist not found' });
  } catch (error) {
    console.error('[FEATURED-PLAYLIST] Error:', error);
    res.status(500).json({ message: 'Failed to fetch featured playlist' });
  }
});

// Featured playlists endpoint - search for YouTube playlists by category with tracks

// Featured playlists endpoint - get specific curated playlists by ID

app.get('/api/featured-playlists', authenticateWithGuest, async (req, res) => {
  const category = String(req.query.category || '').trim();
  if (!category) return res.status(400).json({ message: 'Category is required' });

  // Curated Playlist IDs provided by user
  const curatedLists: Record<string, string[]> = {
    'hits-2025': [
      'RDCLAK5uy_n-bIDnwYZcryDfgspID25XdIijP4SVcYI', // Hits of 2025
      'RDCLAK5uy_kt5FBmiCq0yT_X7QzsgBzT0QzoWZ-6UwI', // Hindi Hits 2025
      'RDCLAK5uy_lYL2XiO10mD9CDlxBi7F1sMn_Fm3T_nQ8', // Punjabi Hits 2025
      'RDCLAK5uy_mb31Ik1DbjkMgqx8nM6mBsICeTUui9t_E', // Telugu Hits 2025
      'RDCLAK5uy_lOB8Innr31rihPB_otfUsnrLiYT_c66Rc'  // Tamil Hits 2025
    ],
    'india-hitlist': [
      'RDCLAK5uy_n9Fbdw7e6ap-98_A-8JYBmPv64v-Uaq1g', // Bollywood Hitlist
      'RDCLAK5uy_kuo_NioExeUmw07dFf8BzQ64DFFTlgE7Q', // Punjab Fire
      'RDCLAK5uy_lj-zBExVYl7YN_NxXboDIh4A-wKGfgzNY', // I-Pop Hits
      'RDCLAK5uy_mPBQePobkU9UZ100tOTfvTCdwWOHoiiPo'  // Tollywood Hitlist
    ],
    'international-hits-2025': [
      'RDCLAK5uy_mmJfIyWtaX2HEYZlnsdRFW-5vUnodSa-U',
      'RDCLAK5uy_nv-tvtQSHjI9sEnN3M6QgK3m5JeaE-6zE',
      'RDCLAK5uy_n3hik1j1i-ShX3hNloQZk3OEgXHiZgif0',
      'RDCLAK5uy_nT9IYNRNArmvrQVnYjSrZNLrM-NGxm1J0'
    ],
    'todays-global-hits': [
      'RDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFKWNJFs',
      'RDCLAK5uy_lBGRuQnsG37Akr1CY4SxL0VWFbPrbO4gs',
      'RDCLAK5uy_lBNUteBRencHzKelu5iDHwLF6mYqjL-JU',
      'RDCLAK5uy_lJ8xZWiZj2GCw7MArjakb6b0zfvqwldps'
    ]
  };

  const playlistIds = curatedLists[category] || [];

  if (playlistIds.length === 0) {
     return res.json([]);
  }

  try {
    const results = await Promise.all(
      playlistIds.map(async (playlistId) => {
        try {
          const playlistData = await uma.fetchJson<any>(
            'piped',
            (base) => `${base}/playlists/${encodeURIComponent(playlistId)}`,
            { strictStatus: false },
            {
              cacheKey: `playlist-tracks:${playlistId}`,
              ttlMs: 1000 * 60 * 60 * 24, 
            },
          );

          if (!playlistData || (!playlistData.relatedStreams && !playlistData.tracks)) return null;

          const videos: any[] = Array.isArray(playlistData.relatedStreams) ? playlistData.relatedStreams : [];
          
          const tracks = videos.slice(0, 50).map((video) => {
             let videoId = video?.url;
             if (typeof videoId === 'string') {
                 if (videoId.includes('v=')) videoId = videoId.split('v=')[1].split('&')[0];
                 else videoId = videoId.split('/').pop();
             }
             
             // Extract best track thumbnail
             let trackThumb = video?.thumbnail;
             if (!trackThumb && Array.isArray(video?.thumbnails)) {
                 trackThumb = video.thumbnails.find((t: any) => t.quality === 'maxres')?.url || video.thumbnails[0]?.url;
             }

             return {
               id: videoId,
               youtubeId: videoId,
               title: video?.title ?? 'Unknown Title',
               artist: video?.uploaderName ?? 'Unknown Artist',
               thumbnail: trackThumb ?? undefined,
               duration: video?.duration ?? 0,
               source: 'youtube' as const,
             };
          });

          // --- THUMBNAIL FIX ---
          // Prioritize the first track's thumbnail because Playlist thumbnails for "Mixes" are often broken or low-res
          let finalThumbnail = tracks.length > 0 ? tracks[0].thumbnail : undefined;
          
          // If first track has no thumb, try playlist thumb
          if (!finalThumbnail) {
             finalThumbnail = playlistData.thumbnailUrl || playlistData.thumbnail;
          }

          return {
            id: playlistId,
            title: playlistData.name || playlistData.title || 'Featured Playlist',
            description: playlistData.description || '',
            thumbnailUrl: finalThumbnail, // Used the robust thumbnail here
            videoCount: tracks.length,
            uploaderName: playlistData.uploaderName || 'YouTube Music',
            tracks,
          };
        } catch (e) {
            console.error(`Failed to fetch playlist ${playlistId}:`, e);
            return null;
        }
      })
    );

    const validPlaylists = results.filter(p => p !== null);
    res.json(validPlaylists);

  } catch (error) {
    console.error('[FEATURED-PLAYLISTS] Error:', error);
    res.status(500).json({ message: 'Failed to fetch featured playlists' });
  }
});


// Proxy endpoint to get a specific external playlist by ID
app.get('/api/proxy/playlist/:id', async (req, res) => {
  const playlistId = req.params.id;
  if (!playlistId) return res.status(400).json({ message: 'Playlist ID is required' });

  try {
    const playlistData = await uma.fetchJson<any>(
      'piped',
      (base) => `${base}/playlists/${encodeURIComponent(playlistId)}`,
      { strictStatus: false },
      {
        cacheKey: `playlist-detail:${playlistId}`,
        ttlMs: 1000 * 60 * 60 * 24, // 24 hours
      },
    );

    if (!playlistData || (!playlistData.relatedStreams && !playlistData.tracks)) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    const videos: any[] = Array.isArray(playlistData.relatedStreams) ? playlistData.relatedStreams : [];
    
    const tracks = videos.slice(0, 100).map((video) => { // Increased limit for detail view
        let videoId = video?.url;
        if (typeof videoId === 'string') {
            if (videoId.includes('v=')) videoId = videoId.split('v=')[1].split('&')[0];
            else videoId = videoId.split('/').pop();
        }
        
        let trackThumb = video?.thumbnail;
        if (!trackThumb && Array.isArray(video?.thumbnails)) {
            trackThumb = video.thumbnails.find((t: any) => t.quality === 'maxres')?.url || video.thumbnails[0]?.url;
        }

        return {
          id: videoId,
          youtubeId: videoId,
          title: video?.title ?? 'Unknown Title',
          artist: video?.uploaderName ?? 'Unknown Artist',
          thumbnail: trackThumb ?? undefined,
          duration: video?.duration ?? 0,
          source: 'youtube' as const,
        };
    });

    // Robust thumbnail logic
    let finalThumbnail = tracks.length > 0 ? tracks[0].thumbnail : undefined;
    if (!finalThumbnail) {
        finalThumbnail = playlistData.thumbnailUrl || playlistData.thumbnail;
    }

    const result = {
      id: playlistId,
      title: playlistData.name || playlistData.title || 'Featured Playlist',
      description: playlistData.description || '',
      thumbnailUrl: finalThumbnail,
      videoCount: tracks.length,
      uploaderName: playlistData.uploaderName || 'YouTube Music',
      tracks,
    };

    res.json(result);
  } catch (error) {
    console.error(`Failed to fetch playlist ${playlistId}:`, error);
    res.status(500).json({ message: 'Failed to fetch playlist' });
  }
});
  // Trending catalog powered by Piped (with fallback search heuristic)
  app.get('/api/trending', authenticateWithGuest, async (req, res) => {
    const region = String(req.query.region || DEFAULT_REGION);
    const seen = new Set<string>();
    const tracks: Array<{
      id: string;
      youtubeId: string;
      title: string;
      artist: string;
      thumbnail?: string;
      duration: number;
      source: 'youtube';
    }> = [];
    

    // Comprehensive list of non-music keywords
    const nonMusicKeywords = [
      // News & Current Events
      'news', 'breaking', 'update', 'report', 'headline', 'politics', 'election', 'election results',
      // Gaming
      'gaming', 'gameplay', 'playthrough', 'walkthrough', 'let\'s play', 'lets play', 'game review',
      'speedrun', 'gamer', 'twitch', 'streamer', 'esports', 'tournament', 'competitive',
      // Lifestyle & Vlogs
      'vlog', 'lifestyle', 'daily vlog', 'day in my life', 'morning routine', 'night routine',
      'fashion', 'outfit', 'haul', 'shopping', 'makeup', 'beauty', 'skincare', 'routine',
      // Food & Cooking
      'recipe', 'cooking', 'baking', 'food', 'restaurant', 'review', 'taste test', 'mukbang',
      'chef', 'kitchen', 'meal prep', 'foodie',
      // Tech & Reviews
      'unboxing', 'review', 'tech review', 'product review', 'comparison', 'vs', 'versus',
      'tutorial', 'how to', 'guide', 'tips', 'tricks', 'explained',
      // Entertainment (Non-Music)
      'podcast', 'interview', 'talk show', 'documentary', 'trailer', 'teaser',
      'movie', 'film', 'episode', 'series', 'tv show', 'comedy', 'skit', 'standup',
      'comedy special', 'netflix', 'disney', 'marvel', 'dc',
      // Live Content
      'livestream', 'live stream', 'live chat', 'streaming', 'live', 'premiere',
      // Educational
      'lecture', 'course', 'class', 'lesson', 'education', 'learning', 'study',
      // Sports
      'sports', 'football', 'soccer', 'basketball', 'highlights', 'match', 'game',
      // Other
      'asmr', 'relaxing', 'meditation', 'yoga', 'workout', 'fitness', 'motivation',
      'inspirational', 'story', 'storytime', 'prank', 'challenge', 'experiment'
    ];

    // Positive indicators that suggest music content
    const musicIndicators = [
      'song', 'music', 'track', 'album', 'single', 'ep', 'mixtape',
      'feat', 'ft.', 'ft ', 'featuring', 'remix', 'cover', 'original',
      'mv', 'music video', 'official audio', 'official video', 'lyrics',
      'artist', 'singer', 'rapper', 'producer', 'dj', 'beat', 'instrumental'
    ];

    const isMusicTrack = (track: ReturnType<typeof mapItemToTrack>, item?: any): boolean => {
      if (!track) return false;
      
      const title = (track.title || '').toLowerCase();
      const artist = (track.artist || '').toLowerCase();
      const text = `${title} ${artist}`;
      
      // Get additional context from item if available
      const itemTitle = item?.title?.toLowerCase() || title;
      const itemDescription = (item?.description || '').toLowerCase();
      const itemAuthor = (item?.author || item?.uploaderName || item?.channelName || artist).toLowerCase();
      const fullText = `${itemTitle} ${itemDescription} ${itemAuthor}`;
      
      // STRICT: Check if it contains ANY non-music keywords
      for (const keyword of nonMusicKeywords) {
        if (fullText.includes(keyword)) {
          return false;
        }
      }
      
      // Check for music indicators - prefer content with music keywords
      let hasMusicIndicator = false;
      for (const indicator of musicIndicators) {
        if (fullText.includes(indicator)) {
          hasMusicIndicator = true;
          break;
        }
      }
      
      // Artist/Channel name validation
      // Music artists typically have short names (1-4 words)
      const artistWords = itemAuthor.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
      
      // If no music indicators AND artist name is very long, likely not music
      if (!hasMusicIndicator && artistWords > 5) {
        // Very long names without music indicators are usually channel names, not artists
        return false;
      }
      
      // If no music indicators AND title is very generic/long, reject
      if (!hasMusicIndicator && itemTitle.length > 60) {
        return false;
      }
      
      // Duration filtering - STRICT: 45 seconds to 10 minutes (600 seconds)
      let duration = track.duration;
      if (!duration && item) {
        duration = item?.lengthSeconds || item?.duration || 0;
      }
      if (duration > 0) {
        if (duration < 45 || duration > 600) {
          return false;
        }
      } else {
        // If no duration available, be cautious
        // Only allow if it has strong music indicators
        if (!hasMusicIndicator) {
          return false;
        }
      }
      
      // Title length check - songs have concise titles
      if (itemTitle.length > 80) {
        return false;
      }
      
      // Additional heuristics:
      // - Reject if description is very long (music videos have shorter descriptions)
      if (itemDescription.length > 500) {
        return false;
      }
      
      // - Reject common non-music patterns
      const nonMusicPatterns = [
        /^\d+\s*(hours?|minutes?|days?)\s*(ago|old)/i, // Time-based titles
        /live\s+(now|stream|chat)/i, // Live streams
        /episode\s+\d+/i, // Episodes
        /part\s+\d+/i, // Multi-part content
        /season\s+\d+/i, // TV seasons
      ];
      
      for (const pattern of nonMusicPatterns) {
        if (pattern.test(itemTitle)) {
          return false;
        }
      }
      
      return true;
    };

    const pushTrack = (track: ReturnType<typeof mapItemToTrack>) => {
      if (!track) return;
      // Track is already validated by isMusicTrack before calling pushTrack
      if (track.duration && track.duration < 45) return;
      if (seen.has(track.id)) return;
      seen.add(track.id);
      tracks.push(track);
    };

    try {
      const response = await uma.fetchJson<any>(
        'piped',
        (base) => `${base}/trending?region=${encodeURIComponent(region)}&type=music`,
        { strictStatus: true },
        {
          cacheKey: `trending:piped:${region}`,
          ttlMs: 1000 * 60 * 10,
        },
      );

      const items: any[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.items)
          ? response.items
          : [];

      const instance = uma.getLastSuccessfulInstance('piped');
      if (instance) {
        console.log('[TRENDING] Piped instance:', instance, 'items:', items.length);
      }

      items.forEach((item) => {
        if (item?.isShort) return;
        const track = mapItemToTrack(item, { source: 'piped', instance });
        // Pass item for additional filtering context
        if (track && isMusicTrack(track, item)) {
          pushTrack(track);
        }
      });
    } catch (error) {
      console.error('Piped trending fetch failed:', error);
    }

    if (tracks.length < 20) {
      try {
        const response = await uma.fetchJson<any>(
          'invidious',
          (base) => `${base}/api/v1/trending?type=music&region=${encodeURIComponent(region)}`,
          { strictStatus: true },
          {
            cacheKey: `trending:invidious:${region}`,
            ttlMs: 1000 * 60 * 10,
          },
        );

        const items: any[] = Array.isArray(response) ? response : [];

        const instance = uma.getLastSuccessfulInstance('invidious');
        if (instance) {
          console.log('[TRENDING] Invidious instance:', instance, 'items:', items.length);
        }

        items.forEach((item) => {
          const track = mapItemToTrack(item, { source: 'invidious', instance });
          if (!track) return;
          // Pass item for additional filtering context
          if (isMusicTrack(track, item)) {
            pushTrack(track);
          }
        });
      } catch (error) {
        console.error('Invidious trending fetch failed:', error);
      }
    }

    if (tracks.length < 40) {
      try {
        const searchResults = await Promise.allSettled(
          TRENDING_QUERIES.map(({ query, weight }) =>
            uma
              .fetchJson<any>(
                'invidious',
                (base) =>
                  `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video&region=${encodeURIComponent(region)}`,
                { strictStatus: true },
                {
                  cacheKey: `trending-search:${region}:${query.toLowerCase()}`,
                  ttlMs: 1000 * 60 * 15,
                },
              )
              .then((items) => ({
                weight,
                instance: uma.getLastSuccessfulInstance('invidious'),
                items: Array.isArray(items) ? items : [],
              })),
          ),
        );

        const scored = new Map<
          string,
          {
            track: ReturnType<typeof mapItemToTrack>;
            score: number;
          }
        >();

        // Use the same comprehensive filtering - convert item to track first
        const isMusicContent = (item: any): boolean => {
          // Convert to track format for consistent filtering
          const track = mapItemToTrack(item, { source: 'invidious', instance: uma.getLastSuccessfulInstance('invidious') });
          if (!track) return false;
          
          // Use the same strict filtering function
          return isMusicTrack(track, item);
        };

        searchResults.forEach((result, queryIndex) => {
          if (result.status !== 'fulfilled') {
            console.error('Trending search failed:', TRENDING_QUERIES[queryIndex]?.query, result.reason);
            return;
          }

          const { items, weight, instance } = result.value;
          items.forEach((item: any, itemIndex: number) => {
            // Filter out non-music content
            if (!isMusicContent(item)) {
              return;
            }
            
            const track = mapItemToTrack(item, { source: 'invidious', instance });
            if (!track) return;
            if (track.duration && track.duration < 45) return;
            const score = weight - itemIndex * 0.01;
            const existing = scored.get(track.id);
            if (existing && existing.score >= score) return;
            scored.set(track.id, { track, score });
          });
        });

        Array.from(scored.values())
          .sort((a, b) => b.score - a.score)
          .forEach(({ track }) => pushTrack(track));
      } catch (error) {
        console.error('Trending search fallback failed:', error);
      }
    }

    res.json(tracks.slice(0, 40));
  });

  // --- BEST STREAM RESOLVER ---
  app.get('/api/streams/:id/best', authenticateWithGuest, async (req, res) => {
    try {
      const youtubeId = req.params.id;
      const preferredSource = typeof req.query.source === 'string' ? (req.query.source.toLowerCase() as 'piped' | 'invidious') : undefined;
      const preferredInstance = typeof req.query.instance === 'string' ? req.query.instance : undefined;
      const resolved = await resolveBestAudioUrl(youtubeId, preferredSource, preferredInstance);
      
      if (!resolved?.url) {
        return res.status(404).json({ 
          message: 'No stream available',
          error: 'All streaming sources failed. Please try again later.',
        });
      }

      const usedInstance = uma.getLastSuccessfulInstance(resolved.source);

      // Helper to build proxy URL
      const makeProxyUrl = (rawUrl: string) => 
        `/api/streams/${encodeURIComponent(youtubeId)}/proxy?src=${encodeURIComponent(rawUrl)}&source=${resolved.source}${usedInstance ? `&instance=${encodeURIComponent(usedInstance)}` : ""}`;

      const proxiedUrl = resolved.url ? makeProxyUrl(resolved.url) : null;
      const proxiedManifestUrl = resolved.manifestUrl ? makeProxyUrl(resolved.manifestUrl) : null;
      
      const videoStreams = (resolved.videoStreams ?? []).map((s) => ({
        ...s,
        proxiedUrl: s.url ? makeProxyUrl(s.url) : null,
      }));
      
      const audioStreams = (resolved.audioStreams ?? []).map((s) => ({
        ...s,
        proxiedUrl: s.url ? makeProxyUrl(s.url) : null,
      }));
      
      res.json({
        url: resolved.url,
        proxiedUrl,
        manifestUrl: proxiedManifestUrl,
        mimeType: resolved.mimeType,
        origin: resolved.source,
        instance: usedInstance,
        videoStreams,
        audioStreams,
      });
      
    } catch (e: any) {
      console.error('Resolve stream failed:', e);
      res.status(500).json({ 
        message: 'Failed to resolve stream',
        error: 'Unable to load stream.',
      });
    }
  });

  // --- PROXY ENDPOINT (FIXED FOR PIPED & INVIDIOUS AUDIO) ---
  app.get('/api/streams/:id/proxy', authenticateWithGuest, async (req, res) => {
    const startTime = Date.now();
    const MAX_PROXY_TIME = 25000; 
    
    try {
      let src = req.query.src as string;
      if (!src) return res.status(400).json({ message: 'Missing src' });

      // Decode the URL
      try { src = decodeURIComponent(src); } catch {}

      // Headers for upstream request
      const headers: Record<string, string> = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'identity',
      };

      // Forward Range Header (Critical for seeking & streaming)
      const rangeHeader = req.headers['range'] || req.headers['Range'];
      if (rangeHeader) {
        headers['range'] = String(rangeHeader);
      }

      // --- EXECUTE REQUEST ---
      const { statusCode, headers: responseHeaders, body } = await request(src, {
        method: 'GET',
        headers,
        maxRedirections: 5,
        bodyTimeout: 15000,
        headersTimeout: 8000,
      });

      // Handle Errors
      if (statusCode >= 400) {
        if (body && typeof body.destroy === 'function') body.destroy();
        return res.status(statusCode).json({ message: 'Upstream error', status: statusCode });
      }

      // --- CRITICAL FIX: CONTENT-TYPE FORCING ---
      let contentType = String(responseHeaders['content-type'] || '');
      
      // Attempt to extract 'itag' from the source URL to determine the REAL content type
      // This works for Piped URLs (query param 'format' or 'itag') and Google URLs
      try {
        const urlObj = new URL(src);
        // Piped often puts the itag in 'format' (e.g. format=251) or 'itag'
        const itag = urlObj.searchParams.get('itag') || urlObj.searchParams.get('format');
        
        if (itag) {
          const forcedMime = getMimeTypeFromItag(itag);
          
          // Force audio mime type if:
          // 1. The original type is generic (octet-stream)
          // 2. The original type is wrong (text/plain - common Google bug)
          // 3. We detected the stream is definitely audio (itag is in our list)
          if (
            contentType === 'application/octet-stream' || 
            contentType === 'text/plain' || 
            forcedMime.startsWith('audio/')
          ) {
            console.log(`[PROXY] Forcing Content-Type: ${contentType} -> ${forcedMime} (itag: ${itag})`);
            contentType = forcedMime;
          }
        }
      } catch (e) {
        // Ignore URL parsing errors
      }

      // --- SEND HEADERS ---
      res.status(statusCode);
      res.setHeader('Content-Type', contentType); // Use our fixed content-type
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Forward specific headers
      const forwardHeaders = ['content-length', 'content-range', 'accept-ranges', 'cache-control', 'last-modified'];
      forwardHeaders.forEach(h => {
        if (responseHeaders[h]) res.setHeader(h, String(responseHeaders[h]));
      });

      // --- PIPE STREAM ---
      if (!body) return res.end();
      
      const stream = body as Readable;
      stream.pipe(res);

      stream.on('error', (err) => {
        console.error('[PROXY] Stream Error:', err);
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });

      res.on('close', () => {
        if (stream.destroy) stream.destroy();
      });

    } catch (error: any) {
      console.error('[PROXY] System Error:', error);
      if (!res.headersSent) res.status(500).json({ message: 'Internal Proxy Error' });
    }
  });

  // Lyrics API route - allow guests
  app.get('/api/lyrics', authenticateWithGuest, async (req, res) => {
    try {
      const title = req.query.title as string;
      const artist = req.query.artist as string;

      if (!title || !artist) {
        return res.status(400).json({ message: "Title and artist required" });
      }

      const response = await fetch(
        `${LYRICS_API_URL}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
      );

      if (!response.ok) {
        return res.json({ lyrics: null });
      }

      const data = (await response.json()) as { lyrics?: string | null };
      res.json({ lyrics: data.lyrics ?? null });
    } catch (error) {
      console.error("Lyrics fetch error:", error);
      res.json({ lyrics: null });
    }
  });

  // Playlist routes
  app.get('/api/playlists', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const playlists = await storage.getPlaylistsByUser(userId);
      res.json(playlists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      res.status(500).json({ message: "Failed to fetch playlists" });
    }
  });

  app.get('/api/playlists/:id', authenticateToken, async (req, res) => {
    try {
      const playlist = await storage.getPlaylist(req.params.id);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      res.json(playlist);
    } catch (error) {
      console.error("Error fetching playlist:", error);
      res.status(500).json({ message: "Failed to fetch playlist" });
    }
  });

  app.post('/api/playlists', authenticateWithGuest, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const playlist = await storage.createPlaylist({
        userId,
        name: req.body.name,
        description: req.body.description,
        isPublic: req.body.isPublic || false,
      });
      res.json(playlist);
    } catch (error) {
      console.error("Error creating playlist:", error);
      res.status(500).json({ message: "Failed to create playlist" });
    }
  });

  app.put('/api/playlists/:id', authenticateToken, async (req, res) => {
    try {
      const playlist = await storage.updatePlaylist(req.params.id, req.body);
      res.json(playlist);
    } catch (error) {
      console.error("Error updating playlist:", error);
      res.status(500).json({ message: "Failed to update playlist" });
    }
  });

  app.delete('/api/playlists/:id', authenticateToken, async (req, res) => {
    try {
      await storage.deletePlaylist(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting playlist:", error);
      res.status(500).json({ message: "Failed to delete playlist" });
    }
  });

  // Playlist tracks routes
  app.get('/api/playlists/:id/tracks', authenticateToken, async (req, res) => {
    try {
      const tracks = await storage.getPlaylistTracks(req.params.id);
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching playlist tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  app.post('/api/playlists/:id/tracks', authenticateToken, async (req, res) => {
    try {
      const tracks = await storage.getPlaylistTracks(req.params.id);
      const position = tracks.length;
      
      const track = await storage.addTrackToPlaylist({
        playlistId: req.params.id,
        youtubeId: req.body.youtubeId,
        title: req.body.title,
        artist: req.body.artist,
        thumbnail: req.body.thumbnail,
        duration: req.body.duration,
        position,
      });
      res.json(track);
    } catch (error) {
      console.error("Error adding track to playlist:", error);
      res.status(500).json({ message: "Failed to add track" });
    }
  });

  app.delete('/api/playlists/:playlistId/tracks/:trackId', authenticateToken, async (req, res) => {
    try {
      await storage.removeTrackFromPlaylist(req.params.trackId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing track from playlist:", error);
      res.status(500).json({ message: "Failed to remove track" });
    }
  });

  // Listening history routes - allow guests (they won't have history but won't error)
  app.post('/api/history', authenticateWithGuest, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Skip history for guest users
      if (userId === 'guest') {
        return res.json({ message: 'History not saved for guest users' });
      }
      const history = await storage.addToHistory({
        userId,
        youtubeId: req.body.youtubeId,
        title: req.body.title,
        artist: req.body.artist,
        thumbnail: req.body.thumbnail,
        duration: req.body.duration,
      });
      res.json(history);
    } catch (error) {
      console.error("Error adding to history:", error);
      res.status(500).json({ message: "Failed to add to history" });
    }
  });

  app.get('/api/history', authenticateWithGuest, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Return empty array for guest users
      if (userId === 'guest') {
        return res.json([]);
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await storage.getHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // Clear listening history
  app.delete('/api/history', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.clearHistory(userId);
      res.json({ message: 'History cleared successfully' });
    } catch (error) {
      console.error("Error clearing history:", error);
      res.status(500).json({ message: "Failed to clear history" });
    }
  });

  // Reset user data (clear history, playlists, uploads)
  app.post('/api/reset', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { clearHistory: clearHist, clearPlaylists, clearUploads } = req.body;

      if (clearHist) {
        await storage.clearHistory(userId);
      }

      if (clearPlaylists) {
        const userPlaylists = await storage.getPlaylistsByUser(userId);
        for (const playlist of userPlaylists) {
          await storage.deletePlaylist(playlist.id);
        }
      }

      if (clearUploads) {
        const userUploads = await storage.getUploadedFiles(userId);
        for (const file of userUploads) {
          await storage.deleteUploadedFile(file.id);
        }
      }

      res.json({ message: 'Data reset successfully' });
    } catch (error) {
      console.error("Error resetting data:", error);
      res.status(500).json({ message: "Failed to reset data" });
    }
  });

  // File upload routes - allow guests to upload
  app.post('/api/upload', authenticateWithGuest, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.id;
      const uploadedFile = await storage.createUploadedFile({
        userId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        title: req.body.title || req.file.originalname,
        artist: req.body.artist,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
      });

      res.json(uploadedFile);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get('/api/uploads', authenticateWithGuest, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const files = await storage.getUploadedFiles(userId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching uploads:", error);
      res.status(500).json({ message: "Failed to fetch uploads" });
    }
  });

  app.get('/api/uploads/:id/stream', authenticateWithGuest, async (req, res) => {
    try {
      const file = await storage.getUploadedFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      res.sendFile(path.resolve(file.filePath));
    } catch (error) {
      console.error("Error streaming file:", error);
      res.status(500).json({ message: "Failed to stream file" });
    }
  });

  app.delete('/api/uploads/:id', authenticateToken, async (req, res) => {
    try {
      await storage.deleteUploadedFile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting upload:", error);
      res.status(500).json({ message: "Failed to delete upload" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}