import React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNavigation } from "@/components/BottomNavigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PlayerBar } from "@/components/PlayerBar";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { useAuth } from "@/hooks/useAuth";
import { UserMenu } from "@/components/UserMenu";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import "./lib/i18n";
import { ReactLenis } from "@studio-freight/react-lenis";
import { PWAInstall } from "@/components/PWAInstall";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Library from "@/pages/Library";
import Upload from "@/pages/Upload";
import CreatePlaylist from "@/pages/CreatePlaylist";
import PlaylistDetail from "@/pages/PlaylistDetail";
import Queue from "@/pages/Queue";
import Lyrics from "@/pages/Lyrics";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import SearchModal from "@/pages/Search";
import ProfilePage from "@/pages/ProfilePage";
import { PrivacyPage } from "@/pages/privacy";
import { TermsOfService } from "@/pages/terms";
import { UserAgreement } from "@/pages/UserAgrement";
import { registerSW } from 'virtual:pwa-register';

function Router() {
  const { isAuthenticated, isLoading, user, login } = useAuth();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  
  // 1. New State for Header Animation
  const [showBrand, setShowBrand] = React.useState(true);

  registerSW({ immediate: true });

  // 2. Timer to toggle animation every 5 seconds
  React.useEffect(() => {
    let timer: NodeJS.Timeout;

    if (showBrand) {
      // CASE A: Brand is visible. Wait 30 seconds before switching to Button.
      timer = setTimeout(() => {
        setShowBrand(false);
      }, 30000); // 30 seconds
    } else {
      // CASE B: Button is visible. Wait 5 seconds before switching back to Brand.
      timer = setTimeout(() => {
        setShowBrand(true);
      }, 5000); // 5 seconds
    }

    return () => clearTimeout(timer);
  }, [showBrand]);

  // Handle OAuth callback token from URL
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (token) {
      localStorage.setItem("auth_token", token);
      
      const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';
      fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      })
        .then(async (res) => {
          if (res.ok) {
            const userData = await res.json();
            localStorage.setItem("auth_user", JSON.stringify(userData));
            login(userData, token);
            window.history.replaceState({}, '', '/');
          } else {
            console.error('Failed to fetch user data:', res.status);
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            window.history.replaceState({}, '', '/');
          }
        })
        .catch((err) => {
          console.error('Error fetching user data:', err);
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          window.history.replaceState({}, '', '/');
        });
    } else if (error) {
      console.error('Auth error:', error);
      if (error === 'oauth_unauthorized') {
        alert('Google OAuth authorization failed. Please check your Google OAuth credentials.');
      } else if (error === 'database_schema_error') {
        alert('Database schema not initialized. Please run: npm run db:push');
      } else if (error === 'database_error') {
        alert('Database connection error. Please try again later or contact support.');
      } else {
        alert(`Authentication error: ${error}`);
      }
      window.history.replaceState({}, '', '/');
    }
  }, [login]);

  // Force navigation when authentication state changes
  React.useEffect(() => {
    if (!isLoading && isAuthenticated && window.location.pathname !== '/') {
      setLocation('/');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const lenisOptions = {
    lerp: 0.1,
    duration: 1.5,
    smoothWheel: true,
    wheelMultiplier: 2,
    touchMultiplier: 2,
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <ReactLenis root options={lenisOptions}>
        <div className="flex min-h-screen w-full bg-background">
          {/* Sidebar */}
          <div className="hidden md:block">
            <AppSidebar />
          </div>
          
          <div className="flex flex-col flex-1 w-full relative">
            {/* --- HEADER START --- */}
            <header className="fixed top-0 right-0 left-0 md:left-[var(--sidebar-width)] flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-md z-50 transition-all duration-300">
              
              {/* LEFT SIDE: Logo + Animated Area */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="hidden md:block">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                </div>
                
                {/* MOBILE ONLY: Logo + Animated Switcher */}
                <div className="md:hidden flex items-center gap-3 relative overflow-hidden">
                  {/* Static Logo (Always visible) */}
                  <img
                    src="./logo.png"
                    alt="MuseMelody"
                    className="h-12 w-12 object-contain shrink-0" 
                  />

                  {/* ANIMATION CONTAINER */}
                  <div className="relative h-8 w-40 flex items-center">
                      
                      {/* 1. The Title (MuseMelody) */}
                      <div className={`absolute left-0 transition-all duration-700 ease-in-out transform w-full
                          ${showBrand ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                          <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent 
                              bg-gradient-to-r 
                              from-[#D65D6A] via-[#E68AA1] to-[#D65D6A]
                              dark:from-[#FF9A9E] dark:via-[#FECFEF] dark:to-[#FF9A9E]
                              drop-shadow-sm truncate">
                          MuseMelody
                          </h1>
                      </div>

                      {/* 2. The PWA Install Button (Mobile) */}
                      <div className={`absolute left-0 transition-all duration-700 ease-in-out transform w-full
                          ${!showBrand ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                          <PWAInstall />
                      </div>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE Icons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Desktop Only PWA Button (Hidden on Mobile since it's animated on the left now) */}
                <div className="hidden md:block">
                  <PWAInstall />
                </div>

                <LanguageSwitcher />
                <ThemeToggle />
                <UserMenu />
              </div>
            </header>
            {/* --- HEADER END --- */}
  
            {/* MAIN: Full width */}
            <main id="main-scroll-container" className="w-full flex-1">
              <div className="pt-[73px] pb-24 md:pb-8 w-full">
                <Switch>
                  <Route path="/" component={Home} />
                  <Route path="/search" component={SearchModal} />
                  <Route path="/library" component={Library} />
                  <Route path="/upload" component={Upload} />
                  <Route path="/create-playlist" component={CreatePlaylist} />
                  <Route path="/playlist/:id" component={PlaylistDetail} />
                  <Route path="/queue" component={Queue} />
                  <Route path="/lyrics" component={Lyrics} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/profile" component={ProfilePage} />
                  <Route path="/privacy" component={PrivacyPage} />
                  <Route path="/terms" component={TermsOfService} />
                  <Route path="/UserAgreement" component={UserAgreement} />
                  <Route component={NotFound} />
                </Switch>
              </div>
            </main>
          </div>
        </div>
      </ReactLenis>
  
      <BottomNavigation />
      <PlayerBar />
      <YouTubePlayer />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Router />
          <ScrollToTop/>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;