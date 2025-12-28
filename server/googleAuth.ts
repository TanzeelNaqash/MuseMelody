import { Strategy as GoogleStrategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import passport from 'passport';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from '@shared/schema';
import { AuthService, type AuthUser } from './auth';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const API_BASE_URL = (process.env.API_BASE_URL ?? process.env.SERVER_URL ?? 'http://localhost:5001').replace(/\/+$/, '');
// In development, Vite runs separately on port 5173 (default Vite port)
// Server (port 5001) handles OAuth callback, then redirects to client (port 5173)
// In production, use configured CLIENT_BASE_URL or default to API_BASE_URL
const DEFAULT_CLIENT_URL = process.env.NODE_ENV === 'production'
  ? (process.env.CLIENT_BASE_URL ?? process.env.APP_URL ?? API_BASE_URL)
  : (process.env.CLIENT_BASE_URL ?? process.env.APP_URL ?? 'http://localhost:5173'); // Vite dev server on 5173
export const CLIENT_BASE_URL = DEFAULT_CLIENT_URL.replace(/\/+$/, '');
export const GOOGLE_CALLBACK_URL = (process.env.GOOGLE_CALLBACK_URL ?? `${API_BASE_URL}/auth/google/callback`).replace(/\/+$/, '');

export function setupGoogleAuth() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('Google OAuth credentials not provided, skipping Google Auth setup');
    return;
  }

  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
  }, async (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
    try {
      const { id: googleId, emails, name, photos } = profile;
      const email = emails?.[0]?.value;

      if (!email) {
        return done(new Error('No email found in Google profile'), undefined);
      }

      // Check if user exists with this Google ID
      let user;
      try {
        user = await db.query.users.findFirst({
          where: eq(users.googleId, googleId),
        });
      } catch (dbError: any) {
        // Handle database errors
        console.error('Database error during Google OAuth:', dbError);
        if (dbError?.code === '42P01') {
          // Table doesn't exist - need to run migrations
          return done(new Error('Database schema not initialized. Please run migrations.'), undefined);
        }
        if (dbError?.message?.includes('certificate') || dbError?.message?.includes('expired')) {
          return done(new Error('Database connection error. Please try again later.'), undefined);
        }
        throw dbError;
      }

      if (user) {
        // User exists, update profile if needed
        if (user.email !== email || user.firstName !== name?.givenName || user.lastName !== name?.familyName) {
          try {
            await db.update(users)
              .set({
                email,
                firstName: name?.givenName,
                lastName: name?.familyName,
                profileImageUrl: photos?.[0]?.value,
                updatedAt: new Date(),
              })
              .where(eq(users.id, user.id));
          } catch (dbError: any) {
            console.error('Database error during Google OAuth profile update:', dbError);
            if (dbError?.code === '42P01') {
              return done(new Error('Database schema not initialized. Please run migrations.'), undefined);
            }
            if (dbError?.message?.includes('certificate') || dbError?.message?.includes('expired')) {
              return done(new Error('Database connection error. Please try again later.'), undefined);
            }
            throw dbError;
          }
        }
      } else {
        // Check if user exists with this email
        try {
          user = await db.query.users.findFirst({
            where: eq(users.email, email),
          });
        } catch (dbError: any) {
          console.error('Database error during Google OAuth:', dbError);
          if (dbError?.code === '42P01') {
            return done(new Error('Database schema not initialized. Please run migrations.'), undefined);
          }
          if (dbError?.message?.includes('certificate') || dbError?.message?.includes('expired')) {
            return done(new Error('Database connection error. Please try again later.'), undefined);
          }
          throw dbError;
        }

        if (user) {
          // Link Google account to existing user
          try {
            await db.update(users)
              .set({
                googleId,
                firstName: name?.givenName || user.firstName,
                lastName: name?.familyName || user.lastName,
                profileImageUrl: photos?.[0]?.value || user.profileImageUrl,
                isEmailVerified: true, // Google emails are verified
                updatedAt: new Date(),
              })
              .where(eq(users.id, user.id));
          } catch (dbError: any) {
            console.error('Database error during Google OAuth update:', dbError);
            if (dbError?.code === '42P01') {
              return done(new Error('Database schema not initialized. Please run migrations.'), undefined);
            }
            if (dbError?.message?.includes('certificate') || dbError?.message?.includes('expired')) {
              return done(new Error('Database connection error. Please try again later.'), undefined);
            }
            throw dbError;
          }
        } else {
          // Create new user
          try {
            const [newUser] = await db.insert(users).values({
              email,
              firstName: name?.givenName,
              lastName: name?.familyName,
              profileImageUrl: photos?.[0]?.value,
              googleId,
              isEmailVerified: true, // Google emails are verified
            }).returning();

            user = newUser;
          } catch (dbError: any) {
            console.error('Database error during Google OAuth insert:', dbError);
            if (dbError?.code === '42P01') {
              return done(new Error('Database schema not initialized. Please run migrations.'), undefined);
            }
            if (dbError?.message?.includes('certificate') || dbError?.message?.includes('expired')) {
              return done(new Error('Database connection error. Please try again later.'), undefined);
            }
            throw dbError;
          }
        }
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profileImageUrl: user.profileImageUrl || undefined,
        isEmailVerified: user.isEmailVerified || false,
      };

      return done(null, authUser);
    } catch (error) {
      return done(error, undefined);
    }
  }));

  // Serialize user for session (only called when session exists)
  passport.serializeUser((user: any, done) => {
    if (!user || !user.id) {
      return done(null, false);
    }
    done(null, user.id);
  });

  // Deserialize user from session (handle missing sessions gracefully)
  passport.deserializeUser(async (id: string, done) => {
    // If session is invalid or missing, just return null
    if (!id) {
      return done(null, false);
    }
    try {
      const user = await AuthService.getUserById(id);
      done(null, user);
    } catch (error) {
      // Return false instead of error to indicate no user found
      done(null, false);
    }
  });
}
