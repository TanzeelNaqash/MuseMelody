import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - Required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: varchar("password"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  googleId: varchar("google_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const otps = pgTable(
  "otps",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email").notNull(),
    code: varchar("code", { length: 10 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    isUsed: boolean("is_used").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_otps_email_type").on(table.email, table.type)],
);

// Playlists table
export const playlists = pgTable("playlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tracks in playlists
export const playlistTracks = pgTable("playlist_tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playlistId: varchar("playlist_id").notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  youtubeId: varchar("youtube_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  artist: varchar("artist", { length: 255 }),
  thumbnail: text("thumbnail"),
  duration: integer("duration"), // in seconds
  position: integer("position").notNull(), // order in playlist
  addedAt: timestamp("added_at").defaultNow(),
});

// Listening history
export const listeningHistory = pgTable("listening_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  youtubeId: varchar("youtube_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  artist: varchar("artist", { length: 255 }),
  thumbnail: text("thumbnail"),
  duration: integer("duration"),
  playedAt: timestamp("played_at").defaultNow(),
});

// Uploaded local files
export const uploadedFiles = pgTable("uploaded_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }),
  artist: varchar("artist", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSize: integer("file_size"),
  filePath: text("file_path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  playlists: many(playlists),
  listeningHistory: many(listeningHistory),
  uploadedFiles: many(uploadedFiles),
  otps: many(otps),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, {
    fields: [playlists.userId],
    references: [users.id],
  }),
  tracks: many(playlistTracks),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistTracks.playlistId],
    references: [playlists.id],
  }),
}));

export const listeningHistoryRelations = relations(listeningHistory, ({ one }) => ({
  user: one(users, {
    fields: [listeningHistory.userId],
    references: [users.id],
  }),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  user: one(users, {
    fields: [uploadedFiles.userId],
    references: [users.id],
  }),
}));

// Zod schemas for inserts
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export const insertOtpSchema = createInsertSchema(otps).omit({
  id: true,
  createdAt: true,
  isUsed: true,
});
export type InsertOtp = z.infer<typeof insertOtpSchema>;
export type Otp = typeof otps.$inferSelect;

export const insertPlaylistSchema = createInsertSchema(playlists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type Playlist = typeof playlists.$inferSelect;

export const insertPlaylistTrackSchema = createInsertSchema(playlistTracks).omit({
  id: true,
  addedAt: true,
});
export type InsertPlaylistTrack = z.infer<typeof insertPlaylistTrackSchema>;
export type PlaylistTrack = typeof playlistTracks.$inferSelect;

export const insertListeningHistorySchema = createInsertSchema(listeningHistory).omit({
  id: true,
  playedAt: true,
});
export type InsertListeningHistory = z.infer<typeof insertListeningHistorySchema>;
export type ListeningHistory = typeof listeningHistory.$inferSelect;

export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  uploadedAt: true,
});
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type UploadedFile = typeof uploadedFiles.$inferSelect;

// Track interface for unified handling of YouTube and local tracks
export interface Track {
  id: string;
  youtubeId?: string;
  title: string;
  artist?: string;
  thumbnail?: string;
  duration?: number;
  source: 'youtube' | 'local';
  fileUrl?: string; // for local files
}
