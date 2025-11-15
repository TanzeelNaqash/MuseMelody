"use client";

import React, { useEffect, useState } from "react";
import { X, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VPNNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export function VPNNotification({ isOpen, onClose, message }: VPNNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger animation
      setTimeout(() => {
        setIsVisible(true);
        setIsAnimating(true);
      }, 10);
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before hiding
      setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex items-end justify-center pointer-events-none",
        "transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      <div
        className={cn(
          "w-full max-w-md mx-4 mb-4 bg-background border border-border rounded-2xl shadow-2xl",
          "pointer-events-auto",
          "transform transition-all duration-300 ease-out",
          isAnimating ? "translate-y-0" : "translate-y-full"
        )}
        style={{
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Handle bar at top (Android style) */}
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Header with close button */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <WifiOff className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Connection Issue</h3>
                <p className="text-sm text-muted-foreground">Stream access blocked</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Message */}
          <div className="mb-4">
            <p className="text-sm text-foreground leading-relaxed">
              {message || "Unable to access stream. This might be due to regional restrictions."}
            </p>
          </div>

          {/* VPN Suggestion */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <Wifi className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">
                  Try using a VPN
                </p>
                <p className="text-xs text-muted-foreground">
                  Switching your location using a VPN might help bypass regional restrictions and access the stream.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Got it
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border bg-background text-foreground font-medium text-sm hover:bg-muted transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

