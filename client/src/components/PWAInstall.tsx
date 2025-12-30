import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already running as a standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log("✅ Install Prompt Ready");
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  };

  // Logic: Show if not installed and prompt is available.
  // We REMOVED !isMobile so it works on Desktop Chrome too (your Router handles the hiding).
  if (isInstalled || !installPrompt) return null;

  return (
    <Button 
      onClick={handleInstall}
      size="sm"
      className="
        relative group overflow-hidden
        bg-gradient-to-r from-[#D65D6A] to-[#E68AA1] 
        dark:from-[#FF9A9E] dark:to-[#FECFEF]
        text-white dark:text-[#582630]
        hover:opacity-90 transition-all duration-300
        shadow-[0_0_15px_rgba(214,93,106,0.3)]
        dark:shadow-[0_0_15px_rgba(255,154,158,0.3)]
        border-0 rounded-full px-4 h-8
      "
    >
      {/* Premium Shimmer Effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />

      {/* Content */}
      <div className="flex items-center gap-2 relative z-20">
        <Download className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" />
        <span className="text-xs font-bold tracking-wide uppercase">
          Install App
        </span>
      </div>
    </Button>
  );
}