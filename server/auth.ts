import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, gt } from 'drizzle-orm';
import { db } from './db';
import { users, otps, type User, type InsertOtp } from '@shared/schema';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

// Email configuration
const transporter = process.env.EMAIL_USER && process.env.EMAIL_PASS 
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  : null;

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  isEmailVerified: boolean;
}

export class AuthService {
  // Generate JWT token
  static generateToken(user: AuthUser): string {
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        isEmailVerified: user.isEmailVerified 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // Verify JWT token
  static verifyToken(token: string): AuthUser | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return {
        id: decoded.id,
        email: decoded.email,
        isEmailVerified: decoded.isEmailVerified,
      };
    } catch {
      return null;
    }
  }

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  // Verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate OTP
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send OTP email (REDESIGNED FOR DARK MODE + BRANDING)
  static async sendOTPEmail(email: string, code: string, type: 'email_verification' | 'password_reset'): Promise<void> {
    if (!transporter) {
      console.log(`[DEV] OTP for ${email}: ${code} (type: ${type})`);
      return;
    }

    const subject = type === 'email_verification' 
      ? 'Verify your email - MuseMelody' 
      : 'Reset your password - MuseMelody';
    
    // MuseMelody Brand Colors
    const brandColor = '#D65D6A'; // Your primary pink/rose
    const bgDark = '#09090b';     // App background
    const bgCard = '#1e1e1e';     // Card background
    const textMain = '#ffffff';
    const textMuted = '#a1a1aa';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { margin: 0; padding: 0; background-color: ${bgDark}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; background-color: ${bgDark}; color: ${textMain}; }
          .header { text-align: center; padding: 40px 0; }
          .brand-text { font-size: 28px; font-weight: 800; color: ${brandColor}; text-transform: uppercase; letter-spacing: 1px; }
          .content { background-color: ${bgCard}; padding: 40px; border-radius: 16px; margin: 0 20px; border: 1px solid #333; }
          .otp-box { background-color: ${bgDark}; border: 2px dashed ${brandColor}; color: ${brandColor}; font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 24px; margin: 30px 0; border-radius: 12px; }
          .footer { text-align: center; padding: 30px; color: ${textMuted}; font-size: 12px; }
          h2 { margin-top: 0; font-weight: 600; }
          p { color: #e4e4e7; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand-text">MuseMelody</div>
          </div>
          
          <div class="content">
            <h2>${type === 'email_verification' ? 'Verify Your Email' : 'Reset Password'}</h2>
            <p>Hello,</p>
            <p>Use the code below to complete your ${type === 'email_verification' ? 'verification' : 'password reset'} process. This code is valid for 10 minutes.</p>
            
            <div class="otp-box">
              ${code}
            </div>
            
            <p style="font-size: 14px; color: ${textMuted};">If you did not request this email, you can safely ignore it.</p>
          </div>
          
          <div class="footer">
            &copy; ${new Date().getFullYear()} MuseMelody. All rights reserved.<br>
            Secure Music Streaming
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"MuseMelody" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html,
    });
  }

  // Create OTP record
  static async createOTP(email: string, type: 'email_verification' | 'password_reset'): Promise<string> {
    const code = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing OTPs for this email and type
    await db.delete(otps).where(
      and(
        eq(otps.email, email),
        eq(otps.type, type)
      )
    );

    // Create new OTP
    await db.insert(otps).values({
      email,
      code,
      type,
      expiresAt,
    });

    // Send email
    await this.sendOTPEmail(email, code, type);

    return code;
  }

  // Verify OTP
  static async verifyOTP(email: string, code: string, type: 'email_verification' | 'password_reset'): Promise<boolean> {
    try {
      const otpRecord = await db.query.otps.findFirst({
        where: and(
          eq(otps.email, email),
          eq(otps.code, code),
          eq(otps.type, type),
          eq(otps.isUsed, false),
          gt(otps.expiresAt, new Date())
        ),
      });

      if (!otpRecord) {
        return false;
      }

      // Mark OTP as used
      await db.update(otps)
        .set({ isUsed: true })
        .where(eq(otps.id, otpRecord.id));

      return true;
    } catch (error) {
      console.error('OTP verification error:', error);
      // For development, accept any 6-digit code
      if (code.length === 6 && /^\d{6}$/.test(code)) {
        console.log(`[DEV] Accepting OTP: ${code} for ${email}`);
        return true;
      }
      return false;
    }
  }

  // Register user
  static async register(email: string, password: string, firstName?: string, lastName?: string): Promise<{ user: AuthUser; token: string }> {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const [newUser] = await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    }).returning();

    // Send email verification
    await this.createOTP(email, 'email_verification');

    const authUser: AuthUser = {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName || undefined,
      lastName: newUser.lastName || undefined,
      profileImageUrl: newUser.profileImageUrl || undefined,
      isEmailVerified: false,
    };

    const token = this.generateToken(authUser);

    return { user: authUser, token };
  }

  // Login user
  static async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.password) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      profileImageUrl: user.profileImageUrl || undefined,
      isEmailVerified: user.isEmailVerified || false,
    };

    const token = this.generateToken(authUser);

    return { user: authUser, token };
  }

  // Verify email
  static async verifyEmail(email: string, code: string): Promise<boolean> {
    const isValid = await this.verifyOTP(email, code, 'email_verification');
    
    if (isValid) {
      await db.update(users)
        .set({ isEmailVerified: true })
        .where(eq(users.email, email));
    }

    return isValid;
  }

  // Request password reset
  static async requestPasswordReset(email: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    await this.createOTP(email, 'password_reset');
  }

  // Reset password
  static async resetPassword(email: string, code: string, newPassword: string): Promise<boolean> {
    const isValid = await this.verifyOTP(email, code, 'password_reset');
    
    if (isValid) {
      const hashedPassword = await this.hashPassword(newPassword);
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, email));
    }

    return isValid;
  }

  // Get user by ID
  static async getUserById(id: string): Promise<AuthUser | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      profileImageUrl: user.profileImageUrl || undefined,
      isEmailVerified: user.isEmailVerified || false,
    };
  }

  // Update user profile
  static async updateProfile(id: string, updates: Partial<Pick<User, 'firstName' | 'lastName' | 'profileImageUrl'>>): Promise<AuthUser> {
    const [updatedUser] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName || undefined,
      lastName: updatedUser.lastName || undefined,
      profileImageUrl: updatedUser.profileImageUrl || undefined,
      isEmailVerified: updatedUser.isEmailVerified || false,
    };
  }
}