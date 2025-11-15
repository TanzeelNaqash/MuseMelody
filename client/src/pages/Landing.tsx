import { useState } from "react";
import { useLocation } from "wouter";
import { Music, Play, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleAuthSuccess = (user: any, token: string) => {
    login(user, token);
    setIsAuthModalOpen(false);
    // Force navigation by using window.location for immediate redirect
    // This ensures the Router component re-renders with new auth state
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card">
      {/* Header with Language Switcher and Theme Toggle */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary)/0.05),transparent_50%)]" />
        
        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <div className="flex justify-center mb-6">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Music className="h-12 w-12 text-primary" />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-4">
            {t('landing.heroTitle')}
            <span className="text-primary">{t('landing.heroTitleHighlight')}</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            {t('landing.heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
              size="lg"
              onClick={() => setIsAuthModalOpen(true)}
              className="text-lg px-8 h-14 bg-primary hover:bg-primary/90"
              data-testid="button-login"
            >
              {t('landing.getStarted')}
              <Play className="ml-2 h-5 w-5" fill="currentColor" />
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 py-24">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-16">
          {t('landing.featuresTitle')}
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-lg bg-card border border-card-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t('landing.searchStreamTitle')}
            </h3>
            <p className="text-muted-foreground">
              {t('landing.searchStreamDesc')}
            </p>
          </div>

          <div className="p-6 rounded-lg bg-card border border-card-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t('landing.uploadMusicTitle')}
            </h3>
            <p className="text-muted-foreground">
              {t('landing.uploadMusicDesc')}
            </p>
          </div>

          <div className="p-6 rounded-lg bg-card border border-card-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {t('landing.lyricsTitle')}
            </h3>
            <p className="text-muted-foreground">
              {t('landing.lyricsDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
          {t('landing.ctaTitle')}
        </h2>
        <p className="text-xl text-muted-foreground mb-8">
          {t('landing.ctaSubtitle')}
        </p>
        <Button
          size="lg"
          onClick={() => setIsAuthModalOpen(true)}
          className="text-lg px-8 h-14 bg-primary hover:bg-primary/90"
          data-testid="button-cta-login"
        >
          {t('landing.signInToContinue')}
        </Button>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
