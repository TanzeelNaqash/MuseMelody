import { useState } from "react";
import { Music, Play, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import Threads from '@/components/ui/Threads'; 

export default function Landing() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleAuthSuccess = (user: any, token: string) => {
    login(user, token);
    setIsAuthModalOpen(false);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* 1. HERO SECTION WITH THREADS BACKGROUND */}
      <div className="relative h-screen flex items-center justify-center px-4 overflow-hidden">
        
        {/* THREADS - Constrained to this parent div (h-screen) */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
          <Threads 
            amplitude={1.5} 
            distance={0.2} 
            enableMouseInteraction={true} 
            color={[1, 0.6, 0.9]} 
          />
        </div>

        {/* Header inside Hero for correct layering */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* Hero Content Overlay */}
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          <div className="flex justify-center mb-6">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center backdrop-blur-md border border-primary/20">
              <Music className="h-12 w-12 text-primary" />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-4 drop-shadow-md">
            {t('landing.heroTitle')}
            <span className="text-primary block md:inline"> {t('landing.heroTitleHighlight')}</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-medium">
            {t('landing.heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
              size="lg"
              onClick={() => setIsAuthModalOpen(true)}
              className="text-lg px-8 h-14 bg-primary hover:bg-primary/90 shadow-xl"
            >
              {t('landing.getStarted')}
              <Play className="ml-2 h-5 w-5" fill="currentColor" />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. SOLID CONTENT SECTIONS (No Threads here) */}
      <div className="relative z-10 bg-background border-t border-border">
        {/* Features Section */}
        <div className="max-w-7xl mx-auto px-4 py-24">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-16">
            {t('landing.featuresTitle')}
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-lg bg-card border border-border shadow-sm">
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

            <div className="p-6 rounded-lg bg-card border border-border shadow-sm">
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

            <div className="p-6 rounded-lg bg-card border border-border shadow-sm">
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
          >
            {t('landing.signInToContinue')}
          </Button>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}