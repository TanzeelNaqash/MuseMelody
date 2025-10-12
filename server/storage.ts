// Blueprint: javascript_database, javascript_log_in_with_replit
import {
  users,
  playlists,
  playlistTracks,
  listeningHistory,
  uploadedFiles,
  type User,
  type UpsertUser,
  type Playlist,
  type InsertPlaylist,
  type PlaylistTrack,
  type InsertPlaylistTrack,
  type ListeningHistory,
  type InsertListeningHistory,
  type UploadedFile,
  type InsertUploadedFile,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations - Required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Playlist operations
  getPlaylistsByUser(userId: string): Promise<Playlist[]>;
  getPlaylist(id: string): Promise<Playlist | undefined>;
  createPlaylist(playlist: InsertPlaylist): Promise<Playlist>;
  updatePlaylist(id: string, playlist: Partial<InsertPlaylist>): Promise<Playlist>;
  deletePlaylist(id: string): Promise<void>;
  
  // Playlist tracks operations
  getPlaylistTracks(playlistId: string): Promise<PlaylistTrack[]>;
  addTrackToPlaylist(track: InsertPlaylistTrack): Promise<PlaylistTrack>;
  removeTrackFromPlaylist(id: string): Promise<void>;
  reorderPlaylistTracks(playlistId: string, trackIds: string[]): Promise<void>;
  
  // Listening history operations
  addToHistory(history: InsertListeningHistory): Promise<ListeningHistory>;
  getHistory(userId: string, limit?: number): Promise<ListeningHistory[]>;
  
  // Uploaded files operations
  getUploadedFiles(userId: string): Promise<UploadedFile[]>;
  getUploadedFile(id: string): Promise<UploadedFile | undefined>;
  createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile>;
  deleteUploadedFile(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations - Required for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Playlist operations
  async getPlaylistsByUser(userId: string): Promise<Playlist[]> {
    return await db
      .select()
      .from(playlists)
      .where(eq(playlists.userId, userId))
      .orderBy(desc(playlists.createdAt));
  }

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    const [playlist] = await db
      .select()
      .from(playlists)
      .where(eq(playlists.id, id));
    return playlist;
  }

  async createPlaylist(playlist: InsertPlaylist): Promise<Playlist> {
    const [newPlaylist] = await db
      .insert(playlists)
      .values(playlist)
      .returning();
    return newPlaylist;
  }

  async updatePlaylist(id: string, playlist: Partial<InsertPlaylist>): Promise<Playlist> {
    const [updated] = await db
      .update(playlists)
      .set({ ...playlist, updatedAt: new Date() })
      .where(eq(playlists.id, id))
      .returning();
    return updated;
  }

  async deletePlaylist(id: string): Promise<void> {
    await db.delete(playlists).where(eq(playlists.id, id));
  }

  // Playlist tracks operations
  async getPlaylistTracks(playlistId: string): Promise<PlaylistTrack[]> {
    return await db
      .select()
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(playlistTracks.position);
  }

  async addTrackToPlaylist(track: InsertPlaylistTrack): Promise<PlaylistTrack> {
    const [newTrack] = await db
      .insert(playlistTracks)
      .values(track)
      .returning();
    return newTrack;
  }

  async removeTrackFromPlaylist(id: string): Promise<void> {
    await db.delete(playlistTracks).where(eq(playlistTracks.id, id));
  }

  async reorderPlaylistTracks(playlistId: string, trackIds: string[]): Promise<void> {
    // Update positions based on order in trackIds array
    for (let i = 0; i < trackIds.length; i++) {
      await db
        .update(playlistTracks)
        .set({ position: i })
        .where(
          and(
            eq(playlistTracks.id, trackIds[i]),
            eq(playlistTracks.playlistId, playlistId)
          )
        );
    }
  }

  // Listening history operations
  async addToHistory(history: InsertListeningHistory): Promise<ListeningHistory> {
    const [newHistory] = await db
      .insert(listeningHistory)
      .values(history)
      .returning();
    return newHistory;
  }

  async getHistory(userId: string, limit: number = 50): Promise<ListeningHistory[]> {
    return await db
      .select()
      .from(listeningHistory)
      .where(eq(listeningHistory.userId, userId))
      .orderBy(desc(listeningHistory.playedAt))
      .limit(limit);
  }

  // Uploaded files operations
  async getUploadedFiles(userId: string): Promise<UploadedFile[]> {
    return await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.userId, userId))
      .orderBy(desc(uploadedFiles.uploadedAt));
  }

  async getUploadedFile(id: string): Promise<UploadedFile | undefined> {
    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, id));
    return file;
  }

  async createUploadedFile(file: InsertUploadedFile): Promise<UploadedFile> {
    const [newFile] = await db
      .insert(uploadedFiles)
      .values(file)
      .returning();
    return newFile;
  }

  async deleteUploadedFile(id: string): Promise<void> {
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, id));
  }
}

export const storage = new DatabaseStorage();
