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
function getMimeTypeFromItag(itag: string | null): string {
  if (!itag) return 'audio/webm'; // Default fallback
  
  const itagNum = parseInt(itag, 10);
  
  // Audio itags mapping
  const audioItags: Record<number, string> = {
    // MP4/AAC audio
    140: 'audio/mp4', // AAC 128kbps
    141: 'audio/mp4', // AAC 256kbps
    256: 'audio/mp4', // AAC
    258: 'audio/mp4', // AAC
    325: 'audio/mp4', // AAC
    328: 'audio/mp4', // AAC
    
    // WebM/Opus audio
    249: 'audio/webm', // Opus 50kbps
    250: 'audio/webm', // Opus 70kbps
    251: 'audio/webm', // Opus 160kbps
    171: 'audio/webm', // WebM audio (Opus)
    172: 'audio/webm', // WebM audio (Opus)
  };
  
  return audioItags[itagNum] || 'audio/webm';
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
        return res.status(404).json({ 
          message: 'No stream available',
          error: 'All streaming sources failed. Please try again later or try switching location using VPN.',
        });
      }

      // Get the instance that was used to fetch this stream
      const usedInstance = uma.getLastSuccessfulInstance(resolved.source);
      const proxiedUrl = `/api/streams/${encodeURIComponent(youtubeId)}/proxy?src=${encodeURIComponent(resolved.url)}&source=${resolved.source}${usedInstance ? `&instance=${encodeURIComponent(usedInstance)}` : ''}`;
      res.json({
        url: resolved.url,
        proxiedUrl,
        manifestUrl: resolved.manifestUrl,
        mimeType: resolved.mimeType,
        origin: resolved.source,
        instance: usedInstance,
      });
    } catch (e: any) {
      console.error('Resolve stream failed:', e);
      res.status(500).json({ 
        message: 'Failed to resolve stream',
        error: 'Unable to load stream. Please try again later or try switching location using VPN.',
      });
    }
  });

  // Proxy the audio stream through our server (no CORS on client)
  app.get('/api/streams/:id/proxy', authenticateWithGuest, async (req, res) => {
    let src = req.query.src as string;
    if (!src) return res.status(400).json({ message: 'Missing src' });

    const youtubeId = req.params.id;
    const source = (req.query.source as string)?.toLowerCase() as 'piped' | 'invidious' | undefined;
    const instance = req.query.instance as string | undefined;

    // Decode the URL (it comes encoded from query params)
    try {
      src = decodeURIComponent(src);
    } catch {
      // If decoding fails, use as-is
    }

    // Helper function to attempt proxying a stream URL using undici
    const attemptProxy = async (streamUrl: string): Promise<{ success: boolean; response?: any; error?: any; needsContentTypeOverride?: boolean }> => {
      // Build headers for Google Video - must match browser exactly
      const headers: Record<string, string> = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'audio/webm,audio/ogg,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'identity', // Don't compress, we're streaming
        'referer': 'https://www.youtube.com/',
        'origin': 'https://www.youtube.com',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-fetch-dest': 'audio',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site',
      };

      // Forward Range header if present (critical for streaming)
      const rangeHeader = req.headers['range'] || req.headers['Range'];
      if (rangeHeader) {
        headers['range'] = String(rangeHeader);
      }

      try {
        // Use undici's request method which returns a proper Node.js stream
        const { statusCode, headers: responseHeaders, body } = await request(streamUrl, {
          headers,
          method: 'GET',
          maxRedirections: 5,
        });

        // Early detection: Check status and content-type
        const contentType = responseHeaders['content-type'] || '';
        const isTextPlain = String(contentType).toLowerCase().includes('text/plain');
        const isGoogleVideo = streamUrl.includes('googlevideo.com');
        
        // If 403, abort early and clean up
        if (statusCode === 403) {
          // Add error handler to prevent unhandled errors
          body.on('error', () => {
            // Silently handle errors when cleaning up
          });
          
          // Drain the stream instead of destroying to avoid unhandled errors
          // This consumes the body without storing it
          body.resume();
          
          // Set a timeout to destroy after draining
          setTimeout(() => {
            try {
              if (!body.destroyed) {
                body.destroy();
              }
            } catch (e) {
              // Ignore destroy errors
            }
          }, 1000);
          
          return { success: false, error: '403 Forbidden' };
        }
        
        // Add error handler for successful responses too
        body.on('error', () => {
          // Silently handle stream errors - they'll be caught in the main handler
        });
        
        // If text/plain from googlevideo.com with 200 status, override content-type
        if (statusCode === 200 && isTextPlain && isGoogleVideo) {
          return { 
            success: true, 
            response: { status: statusCode, headers: responseHeaders, body }, 
            needsContentTypeOverride: true 
          };
        }

        return { 
          success: true, 
          response: { status: statusCode, headers: responseHeaders, body } 
        };
      } catch (error: any) {
        return { success: false, error: error.message || error };
      }
    };

    // Try the provided URL first
    let result = await attemptProxy(src);
    
    // If failed, try re-fetching from the same source
    if (!result.success && source) {
      console.log(`[PROXY] Initial attempt failed, clearing cache and re-fetching from ${source}...`);
      clearResolvedStreamCache(youtubeId);
      try {
        const resolved = await resolveBestAudioUrl(youtubeId, source, instance);
        if (resolved?.url && resolved.url !== src) {
          console.log(`[PROXY] Got new URL from ${source}, attempting proxy...`);
          result = await attemptProxy(resolved.url);
          if (result.success) {
            src = resolved.url;
          }
        }
      } catch (error) {
        console.warn(`[PROXY] Re-fetch from ${source} failed:`, error);
      }
    }

    // If still failed, try alternative sources
    if (!result.success && source) {
      const altSource = source === 'piped' ? 'invidious' : 'piped';
      console.log(`[PROXY] Trying alternative source: ${altSource}...`);
      clearResolvedStreamCache(youtubeId);
      try {
        const resolved = await resolveBestAudioUrl(youtubeId, altSource);
        if (resolved?.url) {
          result = await attemptProxy(resolved.url);
          if (result.success) {
            src = resolved.url;
          }
        }
      } catch (error) {
        console.warn(`[PROXY] Alternative source ${altSource} failed:`, error);
      }
    }

    // If all attempts failed, return error
    if (!result.success || !result.response) {
      console.error('[PROXY] All attempts failed:', {
        success: result.success,
        error: result.error,
        hasResponse: !!result.response,
        status: result.response?.status,
        youtubeId,
        source,
        instance,
      });
      
      if (result.response?.status === 403) {
        return res.status(403).json({ 
          message: 'Access denied by video provider',
          error: 'Unable to access stream. Please try again later or try switching location using VPN.',
        });
      }
      
      return res.status(500).json({ 
        message: 'Proxy error',
        error: 'Unable to proxy stream. Please try again later.',
      });
    }

    const upstream = result.response;

    // Forward status code
    res.status(upstream.status);

    // Handle content-type override for text/plain responses from googlevideo.com
    let contentType = String(upstream.headers['content-type'] || '');
    if (result.needsContentTypeOverride && src.includes('googlevideo.com')) {
      try {
        const urlObj = new URL(src);
        const itag = urlObj.searchParams.get('itag');
        const correctMimeType = getMimeTypeFromItag(itag);
        console.warn(`[PROXY] googlevideo.com returned text/plain → overriding to ${correctMimeType} (itag: ${itag || 'unknown'})`);
        contentType = correctMimeType;
      } catch (error) {
        console.warn('[PROXY] Failed to parse URL for itag, using default audio/webm');
        contentType = 'audio/webm';
      }
    }

    // Forward relevant response headers
    const headersToForward = [
      'content-length',
      'accept-ranges',
      'content-range',
      'etag',
      'last-modified',
      'cache-control'
    ];

    Object.entries(upstream.headers).forEach(([key, value]: [string, any]) => {
      const lowerKey = key.toLowerCase();
      if (headersToForward.includes(lowerKey)) {
        res.setHeader(key, String(value));
      }
    });

    // Set content-type (overridden if needed)
    res.setHeader('Content-Type', contentType);
    
    // Handle Content-Range for partial content (206)
    if (upstream.status === 206) {
      const contentRange = upstream.headers['content-range'];
      if (contentRange) {
        res.setHeader('Content-Range', String(contentRange));
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

    // Stream the response body using undici's body stream (which is a Node.js Readable stream)
    try {
      if (!upstream.body) {
        console.warn('[PROXY] No body in response');
        return res.end();
      }

      // undici's request returns body as a Node.js Readable stream
      const bodyStream = upstream.body as Readable;
      
      // Pipe the stream to the response
      bodyStream.pipe(res);
      
      // Handle stream errors
      bodyStream.on('error', (streamError: any) => {
        console.error('[PROXY] Stream error:', streamError);
        if (!res.headersSent) {
          res.status(500).json({ 
            message: 'Stream error',
            error: 'Error while streaming content.',
          });
        } else {
          res.end();
        }
      });

      // Handle response end/close
      res.on('close', () => {
        if (bodyStream && typeof bodyStream.destroy === 'function') {
          try {
            bodyStream.destroy();
          } catch (destroyError) {
            // Ignore destroy errors
          }
        }
      });
    } catch (streamError: any) {
      console.error('[PROXY] Failed to pipe stream:', streamError);
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: 'Stream error',
          error: 'Failed to stream content.',
        });
      }
      res.end();
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

