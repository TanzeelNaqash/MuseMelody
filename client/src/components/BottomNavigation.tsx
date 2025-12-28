import { Home, Search, Library, Plus, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const menuItems = [
  { title: "Home", url: "/", icon: Home, testId: "nav-home" },
  { title: "Search", url: "/search", icon: Search, testId: "nav-search" },
  { title: "Library", url: "/library", icon: Library, testId: "nav-library" },
  { title: "Create", url: "/create-playlist", icon: Plus, testId: "nav-create-playlist" },
  { title: "Upload", url: "/upload", icon: Upload, testId: "nav-upload" },
];

export function BottomNavigation() {
  const [location, setLocation] = useLocation();

  // Helper to check if a route is active (handles exact matches and sub-routes)
  const isActiveRoute = (url: string) => {
    if (url === "/") {
      return location === "/";
    }
    return location.startsWith(url);
  };

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    setLocation(url);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{ 
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        height: 'calc(64px + env(safe-area-inset-bottom))'
      }}
    >
      {/* Material Design elevation shadow - multiple layers for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/15 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
      
      {/* Backdrop blur for modern glass effect */}
      <div className="absolute inset-0 backdrop-blur-xl bg-background/95 border-t border-border/60 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1),0_-2px_4px_-1px_rgba(0,0,0,0.06)]" />
      
      {/* Navigation items */}
      <div className="relative flex items-center justify-around px-1 py-2 h-full">
        {menuItems.map((item) => {
          const isActive = isActiveRoute(item.url);
          
          return (
            <a
              key={item.url}
              href={item.url}
              onClick={(e) => handleNavigation(e, item.url)}
              data-testid={item.testId}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 min-w-0 flex-1",
                "px-2 py-1.5 rounded-xl transition-all duration-300 ease-out",
                "active:scale-90 active:opacity-80",
                "touch-manipulation", // Disable double-tap zoom on mobile
                "cursor-pointer select-none",
                isActive
                  ? "text-primary" 
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              {/* Active ripple effect - behind content */}
              {isActive && (
                <div className="absolute inset-0 rounded-xl bg-primary/10 animate-in fade-in duration-300" />
              )}
              
              {/* Icon container with active indicator */}
              <div className={cn(
                "relative flex items-center justify-center z-10",
                "w-6 h-6 transition-all duration-300 ease-out",
                isActive && "scale-110"
              )}>
                <item.icon 
                  className={cn(
                    "w-5 h-5 transition-all duration-300 ease-out",
                    isActive && "drop-shadow-sm"
                  )} 
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full animate-in fade-in zoom-in duration-300" />
                )}
              </div>
              
              {/* Label */}
              <span className={cn(
                "relative z-10 text-[10px] font-semibold leading-tight text-center",
                "transition-all duration-300 ease-out",
                "whitespace-nowrap",
                isActive ? "opacity-100 scale-100" : "opacity-70 scale-95"
              )}>
                {item.title}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

