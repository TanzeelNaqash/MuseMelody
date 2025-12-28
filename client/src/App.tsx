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
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import "./lib/i18n";

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
function Router() {
  const { isAuthenticated, isLoading, user, login } = useAuth();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  // Handle OAuth callback token from URL - run before useAuth checks
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    // Process token if present (don't check isAuthenticated - process immediately)
    if (token) {
      // Store token immediately
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
            // Store user data
            localStorage.setItem("auth_user", JSON.stringify(userData));
            // Update state immediately
            login(userData, token);
            // Clean URL
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
      // Show user-friendly error message
      if (error === 'oauth_unauthorized') {
        alert('Google OAuth authorization failed. Please check your Google OAuth credentials.');
      } else if (error === 'database_schema_error') {
        alert('Database schema not initialized. Please run: npm run db:push');
      } else if (error === 'database_error') {
        alert('Database connection error. Please try again later or contact support.');
      } else {
        alert(`Authentication error: ${error}`);
      }
      // Clean URL
      window.history.replaceState({}, '', '/');
    }
  }, [login]); // Include login in dependencies

  // Force navigation when authentication state changes from false to true
  React.useEffect(() => {
    if (!isLoading && isAuthenticated && window.location.pathname !== '/') {
      // User just authenticated, navigate to home
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

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex flex-col flex-1 w-full md:w-auto">
          <header className="flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-40">
            <div className="flex items-center gap-2">
              {/* Sidebar trigger - hidden on mobile */}
              <div className="hidden md:block">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </div>
              {/* Mobile header title */}
              <div className="md:hidden flex items-center">
  <img
    src="/musemelody.png"
    alt="MuseMelody"
    className="h-8 w-8 mr-2"
  />
  <h1 className="text-lg font-semibold text-lg font-semibold bg-clip-text text-transparent 
               bg-gradient-to-r from-[#D4AF37] via-[#B8860B] to-[#8B5A2B]">MuseMelody</h1>
</div>

            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>
          <main className={cn(
            "flex-1 overflow-auto",
            // Add bottom padding on mobile to account for bottom navigation
            "pb-20 md:pb-0"
          )}>
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
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
      {/* Bottom Navigation - only on mobile (hidden on desktop with CSS) */}
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
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
