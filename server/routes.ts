import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuthRoutes, authenticateToken, authenticateWithGuest } from "./authRoutes";
import multer from "multer";
import path from "path";
import { mkdirSync, existsSync } from "fs";
import { resolveBestAudioUrl } from "./streamResolver";
import fetch from 'node-fetch';
import { uma } from './umaManager';

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
          `${base}/search?q=${encodeURIComponent(q)}&region=${encodeURIComponent(region)}&filter=music_songs`,
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
          .filter((item: any) => (item?.lengthSeconds ?? 0) >= 60)
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

    const pushTrack = (track: ReturnType<typeof mapItemToTrack>) => {
      if (!track) return;
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
        pushTrack(mapItemToTrack(item, { source: 'piped', instance }));
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
          pushTrack(track);
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

        searchResults.forEach((result, queryIndex) => {
          if (result.status !== 'fulfilled') {
            console.error('Trending search failed:', TRENDING_QUERIES[queryIndex]?.query, result.reason);
            return;
          }

          const { items, weight, instance } = result.value;
          items.forEach((item: any, itemIndex: number) => {
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

  // Resolve best audio URL (server-side) to avoid CORS
  app.get('/api/streams/:id/best', authenticateWithGuest, async (req, res) => {
    try {
      const youtubeId = req.params.id;
      const preferredSource = typeof req.query.source === 'string' ? (req.query.source.toLowerCase() as 'piped' | 'invidious') : undefined;
      const preferredInstance = typeof req.query.instance === 'string' ? req.query.instance : undefined;
      const resolved = await resolveBestAudioUrl(youtubeId, preferredSource, preferredInstance);
      if (!resolved?.url) {
        try {
          console.warn('[STREAM] No stream available for id:', youtubeId, 'last piped:', uma.getLastSuccessfulInstance('piped') || 'unknown', 'last invidious:', uma.getLastSuccessfulInstance('invidious') || 'unknown');
        } catch {}
        return res.status(404).json({ message: 'No stream available' });
      }

      const proxiedUrl = `/api/streams/${encodeURIComponent(youtubeId)}/proxy?src=${encodeURIComponent(resolved.url)}`;
      res.json({
        url: resolved.url,
        proxiedUrl,
        manifestUrl: resolved.manifestUrl,
        mimeType: resolved.mimeType,
        origin: resolved.source,
      });
    } catch (e: any) {
      console.error('Resolve stream failed:', e);
      res.status(500).json({ message: 'Failed to resolve stream' });
    }
  });

  // Proxy the audio stream through our server (no CORS on client)
  app.get('/api/streams/:id/proxy', authenticateWithGuest, async (req, res) => {
    try {
      let src = req.query.src as string;
      if (!src) return res.status(400).json({ message: 'Missing src' });

      // Decode the URL (it comes encoded from query params)
      try {
        src = decodeURIComponent(src);
      } catch {
        // If decoding fails, use as-is
      }

      // Build headers for Google Video
      const headers: Record<string, string> = {
        // Use a proper browser User-Agent (Google blocks non-browser UAs)
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
      };

      // Forward Range header if present (critical for streaming)
      const rangeHeader = req.headers['range'] || req.headers['Range'];
      if (rangeHeader) {
        headers['Range'] = String(rangeHeader);
      }

      // Stream with proper headers
      const upstream = await fetch(src, {
        headers,
      });

      // Forward status code
      res.status(upstream.status);

      // Forward relevant response headers
      upstream.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if ([
          'content-type',
          'content-length',
          'accept-ranges',
          'content-range',
          'etag',
          'last-modified',
          'cache-control'
        ].includes(lowerKey)) {
          res.setHeader(key, value);
        }
      });

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range');

      // Stream the response body
      if (!upstream.body) return res.end();
      (upstream.body as any).pipe(res);
    } catch (e: any) {
      console.error('Proxy stream failed:', e);
      res.status(500).end();
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

  // Listening history routes
  app.post('/api/history', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
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

  app.get('/api/history', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await storage.getHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
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

