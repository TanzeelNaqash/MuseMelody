import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import multer from "multer";
import path from "path";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const LYRICS_API_URL = "https://api.lyrics.ovh/v1";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!existsSync(uploadDir)) {
  await mkdir(uploadDir, { recursive: true });
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
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // YouTube API routes
  app.get('/api/youtube/search', isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Query parameter required" });
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=10&key=${YOUTUBE_API_KEY}`
      );

      if (!response.ok) {
        throw new Error("YouTube API request failed");
      }

      const data = await response.json();
      
      // Get video details for duration
      const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
      const detailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`
      );
      const detailsData = await detailsResponse.json();

      const results = data.items.map((item: any, index: number) => {
        const duration = parseDuration(detailsData.items[index]?.contentDetails?.duration || 'PT0S');
        return {
          id: item.id.videoId,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          duration,
        };
      });

      res.json(results);
    } catch (error) {
      console.error("YouTube search error:", error);
      res.status(500).json({ message: "Failed to search YouTube" });
    }
  });

  app.get('/api/youtube/trending', isAuthenticated, async (req, res) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&chart=mostPopular&videoCategoryId=10&maxResults=20&key=${YOUTUBE_API_KEY}`
      );

      if (!response.ok) {
        throw new Error("YouTube API request failed");
      }

      const data = await response.json();

      const results = data.items.map((item: any) => ({
        id: item.id,
        youtubeId: item.id,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
        duration: parseDuration(item.contentDetails?.duration || 'PT0S'),
        source: 'youtube',
      }));

      res.json(results);
    } catch (error) {
      console.error("YouTube trending error:", error);
      res.status(500).json({ message: "Failed to fetch trending" });
    }
  });

  // Lyrics API route
  app.get('/api/lyrics', isAuthenticated, async (req, res) => {
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

      const data = await response.json();
      res.json({ lyrics: data.lyrics });
    } catch (error) {
      console.error("Lyrics fetch error:", error);
      res.json({ lyrics: null });
    }
  });

  // Playlist routes
  app.get('/api/playlists', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const playlists = await storage.getPlaylistsByUser(userId);
      res.json(playlists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      res.status(500).json({ message: "Failed to fetch playlists" });
    }
  });

  app.get('/api/playlists/:id', isAuthenticated, async (req, res) => {
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

  app.post('/api/playlists', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.put('/api/playlists/:id', isAuthenticated, async (req, res) => {
    try {
      const playlist = await storage.updatePlaylist(req.params.id, req.body);
      res.json(playlist);
    } catch (error) {
      console.error("Error updating playlist:", error);
      res.status(500).json({ message: "Failed to update playlist" });
    }
  });

  app.delete('/api/playlists/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deletePlaylist(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting playlist:", error);
      res.status(500).json({ message: "Failed to delete playlist" });
    }
  });

  // Playlist tracks routes
  app.get('/api/playlists/:id/tracks', isAuthenticated, async (req, res) => {
    try {
      const tracks = await storage.getPlaylistTracks(req.params.id);
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching playlist tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  app.post('/api/playlists/:id/tracks', isAuthenticated, async (req, res) => {
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

  app.delete('/api/playlists/:playlistId/tracks/:trackId', isAuthenticated, async (req, res) => {
    try {
      await storage.removeTrackFromPlaylist(req.params.trackId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing track from playlist:", error);
      res.status(500).json({ message: "Failed to remove track" });
    }
  });

  // Listening history routes
  app.post('/api/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.get('/api/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await storage.getHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // File upload routes
  app.post('/api/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
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

  app.get('/api/uploads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const files = await storage.getUploadedFiles(userId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching uploads:", error);
      res.status(500).json({ message: "Failed to fetch uploads" });
    }
  });

  app.get('/api/uploads/:id/stream', isAuthenticated, async (req, res) => {
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

  app.delete('/api/uploads/:id', isAuthenticated, async (req, res) => {
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

// Helper function to parse YouTube duration format (PT1H2M10S) to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}
