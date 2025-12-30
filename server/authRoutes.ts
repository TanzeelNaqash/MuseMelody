import type { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
// REMOVED: import session from "express-session"; <-- Not needed here anymore
import { AuthService, type AuthUser } from "./auth";
import { setupGoogleAuth, CLIENT_BASE_URL } from "./googleAuth";
import { uma } from "./umaManager";
import multer from "multer";
import path from "path";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import type { AuthenticateOptionsGoogle } from "passport-google-oauth20";

export function setupAuthRoutes(app: Express) {
  // --- REMOVED: Conflicting Session Middleware ---
  // The session is now handled in server/index.ts using connect-pg-simple.
  // We do NOT need app.use(session(...)) here.

  // Setup Google OAuth
  setupGoogleAuth();
  
  app.use(passport.initialize());
  
  // Only use passport.session() for OAuth routes that actually need sessions
  // For JWT-based auth and guest users, we don't need sessions, so skip passport.session()
  app.use((req: any, res: Response, next: NextFunction) => {
    // Only apply passport.session() to OAuth routes
    const isOAuthRoute = req.path?.startsWith('/api/auth/google');
    
    if (isOAuthRoute) {
      // For OAuth routes, use passport.session() but wrap it to handle errors
      const passportSession = passport.session();
      return passportSession(req, res, (err: any) => {
        if (err) {
          console.warn('Passport session error (non-fatal):', err.message);
        }
        next();
      });
    }
    
    // For all other routes (JWT auth, guest users), skip passport.session()
    next();
  });

  // Register
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      const { user, token } = await AuthService.register(email, password, firstName, lastName);

      res.status(201).json({
        message: 'User registered successfully. Please check your email for verification.',
        user,
        token,
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(400).json({ message: error.message || 'Registration failed' });
    }
  });

  // Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const { user, token } = await AuthService.login(email, password);

      res.json({
        message: 'Login successful',
        user,
        token,
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({ message: error.message || 'Login failed' });
    }
  });

  // Verify email
  app.post('/api/auth/verify-email', async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ message: 'Email and code are required' });
      }

      const isValid = await AuthService.verifyEmail(email, code);

      if (isValid) {
        res.json({ message: 'Email verified successfully' });
      } else {
        res.status(400).json({ message: 'Invalid or expired code' });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Resend verification email
  app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      await AuthService.createOTP(email, 'email_verification');

      res.json({ message: 'Verification email sent' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Request password reset
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      await AuthService.requestPasswordReset(email);

      res.json({ message: 'Password reset email sent' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Reset password
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { email, code, newPassword } = req.body;

      if (!email || !code || !newPassword) {
        return res.status(400).json({ message: 'Email, code, and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      const isValid = await AuthService.resetPassword(email, code, newPassword);

      if (isValid) {
        res.json({ message: 'Password reset successfully' });
      } else {
        res.status(400).json({ message: 'Invalid or expired code' });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Google OAuth routes (only if configured)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // Request account selection to avoid auto-signin with previous Google session
    const googleAuthOptions: AuthenticateOptionsGoogle = {
      scope: ["profile", "email"],
      prompt: "select_account",
      accessType: "offline",
    };
    app.get("/api/auth/google", passport.authenticate("google", googleAuthOptions));

    // Always redirect to CLIENT_BASE_URL (localhost:5173 in dev)
    const getRedirectUrl = () => CLIENT_BASE_URL;

    const handleGoogleCallback = async (req: Request, res: Response) => {
      try {
        const user = req.user as AuthUser;
        if (!user) {
          console.error('Google OAuth: No user in request');
          return res.redirect(`${CLIENT_BASE_URL}/?error=auth_failed`);
        }
        
        // Verify and store credentials on server (port 5001)
        const token = AuthService.generateToken(user);

        // Redirect to client (localhost:5173) with token
        res.redirect(`${CLIENT_BASE_URL}/?token=${encodeURIComponent(token)}`);
      } catch (error: any) {
        console.error('Google OAuth callback error:', error);
        const errorMessage = error?.message || 'auth_failed';
        
        if (error?.code === '42P01' || errorMessage.includes('schema not initialized') || errorMessage.includes('migrations')) {
          return res.redirect(`${CLIENT_BASE_URL}/?error=database_schema_error`);
        }
        if (errorMessage.includes('certificate') || errorMessage.includes('expired')) {
          console.error('SSL Certificate error - this may be a Node.js certificate issue');
          return res.redirect(`${CLIENT_BASE_URL}/?error=database_error`);
        }
        res.redirect(`${CLIENT_BASE_URL}/?error=${encodeURIComponent(errorMessage)}`);
      }
    };

    // Handle both callback paths
    const passportAuth = passport.authenticate("google", { 
      session: false, // Don't use sessions, we'll use JWT tokens
    });
    
    app.get(
      "/auth/google/callback",
      (req: Request, res: Response, next: NextFunction) => {
        passportAuth(req, res, (err: any) => {
          if (err) {
            console.error('Passport authentication error:', err);
            if (err?.message?.includes('Unauthorized') || err?.name === 'TokenError') {
              return res.redirect(`${CLIENT_BASE_URL}/?error=oauth_unauthorized`);
            }
            if (err?.code === '42P01' || err?.message?.includes('schema not initialized') || err?.message?.includes('migrations')) {
              return res.redirect(`${CLIENT_BASE_URL}/?error=database_schema_error`);
            }
            if (err?.message?.includes('certificate') || err?.message?.includes('expired')) {
              return res.redirect(`${CLIENT_BASE_URL}/?error=database_error`);
            }
            return res.redirect(`${CLIENT_BASE_URL}/?error=google_auth_failed`);
          }
          next();
        });
      },
      handleGoogleCallback,
    );
    
    app.get(
      "/api/auth/google/callback",
      (req: Request, res: Response, next: NextFunction) => {
        passportAuth(req, res, (err: any) => {
          if (err) {
            console.error('Passport authentication error:', err);
            if (err?.message?.includes('Unauthorized') || err?.name === 'TokenError') {
              return res.redirect(`${CLIENT_BASE_URL}/?error=oauth_unauthorized`);
            }
            if (err?.code === '42P01' || err?.message?.includes('schema not initialized') || err?.message?.includes('migrations')) {
              return res.redirect(`${CLIENT_BASE_URL}/?error=database_schema_error`);
            }
            if (err?.message?.includes('certificate') || err?.message?.includes('expired')) {
              return res.redirect(`${CLIENT_BASE_URL}/?error=database_error`);
            }
            return res.redirect(`${CLIENT_BASE_URL}/?error=google_auth_failed`);
          }
          next();
        });
      },
      handleGoogleCallback,
    );
  } else {
    // Fallback routes when Google OAuth is not configured
    app.get('/api/auth/google', (req: Request, res: Response) => {
      res.status(400).json({ 
        message: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.' 
      });
    });

    app.get('/auth/google/callback', (req: Request, res: Response) => {
      res.redirect(`${CLIENT_BASE_URL}/?error=google_oauth_not_configured`);
    });
  }

  // Get current user
  app.get('/api/auth/me', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = await AuthService.getUserById((req as any).user.id);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Update profile
  app.put('/api/auth/profile', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, profileImageUrl } = req.body;
      const user = await AuthService.updateProfile((req as any).user.id, {
        firstName,
        lastName,
        profileImageUrl,
      });

      res.json({ message: 'Profile updated successfully', user });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    try {
      // Clear passport user manually
      if ((req as any).user) {
        delete (req as any).user;
      }
      
      // Clear passport session data if it exists
      if ((req as any)._passport && (req as any)._passport.session) {
        delete (req as any)._passport.session;
      }

      // Destroy the express session if present
      if (req.session) {
        req.session.destroy((err) => {
          res.clearCookie('connect.sid', { path: '/' });
          if (err) {
            console.error('Session destroy error during logout:', err);
            return res.status(500).json({ message: 'Failed to destroy session' });
          }
          return res.json({ message: 'Logged out successfully' });
        });
      } else {
        res.clearCookie('connect.sid', { path: '/' });
        return res.json({ message: 'Logged out successfully' });
      }
    } catch (error: any) {
      console.error('Logout error:', error);
      res.clearCookie('connect.sid', { path: '/' });
      return res.status(500).json({ message: 'Logout failed' });
    }
  });
}

// Middleware to authenticate JWT token
export function authenticateToken(req: Request, res: Response, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  // Allow guest tokens
  if (token === 'guest-token') {
    (req as any).user = { id: 'guest', email: 'guest@musemelody.com' };
    return next();
  }

  const user = AuthService.verifyToken(token);
  if (!user) {
    return res.status(430).json({ message: 'Invalid or expired token' });
  }

  (req as any).user = user;
  next();
}

// Middleware to allow guests for certain routes
export function authenticateWithGuest(req: Request, res: Response, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  // If no token provided, allow as guest
  if (!token) {
    (req as any).user = { id: 'guest', email: 'guest@musemelody.com' };
    return next();
  }

  // Allow explicit guest token
  if (token === 'guest-token') {
    (req as any).user = { id: 'guest', email: 'guest@musemelody.com' };
    return next();
  }

  // Verify regular JWT
  const user = AuthService.verifyToken(token);
  if (!user) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  (req as any).user = user;
  next();
}