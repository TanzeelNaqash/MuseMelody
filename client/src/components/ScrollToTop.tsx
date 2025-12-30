import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const [pathname] = useLocation();

  // Helper to find the actual scrolling element
  const getScrollContainer = () => {
    // 1. Try to find the main scrollable area by ID (we will add this ID next)
    const container = document.getElementById("main-scroll-container");
    // 2. Fallback to window if no container is found
    return container || window;
  };

  // ---------------------------------------------------------------------------
  // FEATURE 1: Automatic Scroll to Top on Route Change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = getScrollContainer();
    
    // Smooth scroll doesn't work well for "instant" page loads, so we use logic
    container.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    
  }, [pathname]); 

  // ---------------------------------------------------------------------------
  // FEATURE 2: Manual Scroll Button Logic
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = getScrollContainer();

    const toggleVisibility = () => {
      // Check scrollTop for Elements, scrollY for Window
      const scrollTop = container instanceof Window ? container.scrollY : container.scrollTop;
      
      if (scrollTop > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Attach event listener to the correct element
    container.addEventListener("scroll", toggleVisibility);
    return () => container.removeEventListener("scroll", toggleVisibility);
  }, [pathname]); // Re-bind if path changes to ensure we have the right element

  const scrollToTopManual = () => {
    const container = getScrollContainer();
    container.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          transition={{ duration: 0.2 }}
          // High Z-Index ensures it sits on top of everything
          className="fixed bottom-24 right-4 z-[9999] sm:bottom-24 sm:right-8"
        >
          {/* <Button
            onClick={scrollToTopManual}
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full shadow-2xl",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "backdrop-blur-sm border border-white/20",
              "transition-all duration-300 hover:scale-110"
            )}
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-6 w-6" />
          </Button> */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}