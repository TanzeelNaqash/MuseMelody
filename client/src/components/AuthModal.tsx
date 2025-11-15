import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any, token: string) => void;
}

type AuthMode = 'login' | 'register' | 'forgot' | 'verify-email' | 'reset-password';

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    code: '',
  });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      code: '',
    });
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    resetForm();
    setMode('login');
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';

    try {
      let response;
      
      switch (mode) {
        case 'register':
          if (formData.password !== formData.confirmPassword) {
            throw new Error(t('auth.passwordsDoNotMatch'));
          }
          console.log('Sending registration request:', {
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
          });
          response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              firstName: formData.firstName,
              lastName: formData.lastName,
            }),
          });
          console.log('Registration response status:', response.status);
          break;

        case 'login':
          console.log('Sending login request:', {
            email: formData.email,
            password: formData.password,
          });
          response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
            }),
          });
          console.log('Login response status:', response.status);
          break;

        case 'forgot':
          response = await fetch(`${API_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email }),
          });
          break;

        case 'verify-email':
          response = await fetch(`${API_URL}/api/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              code: formData.code,
            }),
          });
          break;

        case 'reset-password':
          if (formData.password !== formData.confirmPassword) {
            throw new Error(t('auth.passwordsDoNotMatch'));
          }
          response = await fetch(`${API_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              code: formData.code,
              newPassword: formData.password,
            }),
          });
          break;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t('auth.unexpectedError'));
      }

      if (mode === 'login') {
        onAuthSuccess(data.user, data.token);
        handleClose();
      } else if (mode === 'register') {
        setSuccess(t('auth.registrationSuccess'));
        setMode('verify-email');
      } else if (mode === 'forgot') {
        setSuccess(t('auth.passwordResetEmailSent'));
        setMode('reset-password');
      } else if (mode === 'verify-email') {
        setSuccess(t('auth.emailVerified'));
        setMode('login');
      } else if (mode === 'reset-password') {
        setSuccess(t('auth.passwordResetSuccess'));
        setMode('login');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError(t('auth.networkError'));
      } else {
        setError(err.message || t('auth.unexpectedError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const renderForm = () => {
    switch (mode) {
      case 'register':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">{t('auth.firstName')}</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">{t('auth.lastName')}</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Doe"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={t('auth.enterPassword')}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 hover:bg-muted"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div>
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder={t('auth.confirmYourPassword')}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.createAccountButton')}
            </Button>
          </form>
        );

      case 'login':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder={t('auth.enterPassword')}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 hover:bg-muted"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto"
                onClick={() => setMode('forgot')}
              >
                {t('auth.forgotPassword')}
              </Button>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.signIn')}
            </Button>
          </form>
        );

      case 'forgot':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.sendResetCode')}
            </Button>
          </form>
        );

      case 'verify-email':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="code">{t('auth.verificationCode')}</Label>
              <Input
                id="code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.verifyEmailButton')}
            </Button>
          </form>
        );

      case 'reset-password':
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="code">{t('auth.resetCode')}</Label>
              <Input
                id="code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder={t('auth.enterNewPassword')}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder={t('auth.confirmNewPassword')}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.resetPasswordButton')}
            </Button>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'login' && t('auth.welcomeBack')}
            {mode === 'register' && t('auth.createAccount')}
            {mode === 'forgot' && t('auth.resetPassword')}
            {mode === 'verify-email' && t('auth.verifyEmail')}
            {mode === 'reset-password' && t('auth.setNewPassword')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
            <TabsTrigger value="register">{t('auth.register')}</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {renderForm()}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleAuth}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {t('auth.continueWithGoogle')}
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                const guestUser = {
                  id: 'guest',
                  email: 'guest@aerogroove.com',
                  firstName: 'Guest',
                  lastName: 'User',
                  isEmailVerified: true
                };
                onAuthSuccess(guestUser, 'guest-token');
                handleClose();
              }}
              disabled={loading}
            >
              {t('auth.continueAsGuest')}
            </Button>
          </TabsContent>

          <TabsContent value="register" className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {renderForm()}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleAuth}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
          </TabsContent>
        </Tabs>

        {(mode === 'forgot' || mode === 'verify-email' || mode === 'reset-password') && (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {renderForm()}

            <div className="text-center">
              <Button
                variant="link"
                onClick={() => setMode('login')}
                className="text-sm"
              >
                {t('auth.backToLogin')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
