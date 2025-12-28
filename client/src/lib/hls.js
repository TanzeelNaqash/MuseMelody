import Hls from "hls.js";
import type Player from "video.js/dist/types/player";

/**
 * HLS.js utility functions for Video.js integration
 */

/**
 * Check if HLS is supported in the current browser
 */
export function isHLSSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Hls.isSupported();
}

/**
 * Check if native HLS is supported (Safari)
 */
export function isNativeHLSSupported(): boolean {
  if (typeof window === "undefined") return false;
  const video = document.createElement("video");
  return video.canPlayType("application/vnd.apple.mpegurl") !== "";
}

/**
 * Initialize HLS.js for a video element
 */
export function initHLS(
  videoElement: HTMLVideoElement,
  manifestUrl: string,
  options?: {
    enableWorker?: boolean;
    lowLatencyMode?: boolean;
    backBufferLength?: number;
    maxBufferLength?: number;
    maxMaxBufferLength?: number;
    startLevel?: number;
    capLevelToPlayerSize?: boolean;
  }
): Hls | null {
  if (!isHLSSupported()) {
    return null;
  }

  const hls = new Hls({
    enableWorker: options?.enableWorker ?? true,
    lowLatencyMode: options?.lowLatencyMode ?? false,
    backBufferLength: options?.backBufferLength ?? 60,
    maxBufferLength: options?.maxBufferLength ?? 30,
    maxMaxBufferLength: options?.maxMaxBufferLength ?? 60,
    startLevel: options?.startLevel,
    capLevelToPlayerSize: options?.capLevelToPlayerSize ?? true,
    debug: false,
  });

  hls.loadSource(manifestUrl);
  hls.attachMedia(videoElement);

  return hls;
}

/**
 * Setup HLS for Video.js player
 */
export function setupHLSForVideoJS(
  player: Player,
  manifestUrl: string,
  options?: {
    enableWorker?: boolean;
    lowLatencyMode?: boolean;
    backBufferLength?: number;
    maxBufferLength?: number;
    maxMaxBufferLength?: number;
  }
): Hls | null {
  const videoElement = player.el().querySelector("video") as HTMLVideoElement;
  if (!videoElement) {
    console.warn("Video element not found in Video.js player");
    return null;
  }

  return initHLS(videoElement, manifestUrl, options);
}

/**
 * Cleanup HLS instance
 */
export function cleanupHLS(hls: Hls | null): void {
  if (hls) {
    try {
      hls.destroy();
    } catch (error) {
      console.error("Error destroying HLS instance:", error);
    }
  }
}

/**
 * Get HLS quality levels
 */
export function getHLSLevels(hls: Hls | null): Array<{ height: number; width: number; bitrate: number; label: string }> {
  if (!hls || !hls.levels) {
    return [];
  }

  return hls.levels.map((level, index) => ({
    height: level.height || 0,
    width: level.width || 0,
    bitrate: level.bitrate || 0,
    label: level.height ? `${level.height}p` : `Level ${index}`,
  }));
}

/**
 * Set HLS quality level
 */
export function setHLSQuality(hls: Hls | null, levelIndex: number): boolean {
  if (!hls || !hls.levels || levelIndex < 0 || levelIndex >= hls.levels.length) {
    return false;
  }

  try {
    hls.currentLevel = levelIndex;
    return true;
  } catch (error) {
    console.error("Error setting HLS quality:", error);
    return false;
  }
}

/**
 * Get current HLS quality level
 */
export function getCurrentHLSQuality(hls: Hls | null): number | null {
  if (!hls) {
    return null;
  }

  return hls.currentLevel;
}

/**
 * Handle HLS errors with automatic recovery
 */
export function setupHLSErrorHandling(
  hls: Hls,
  onError?: (error: any) => void,
  fallbackUrl?: string
): void {
  hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal) {
      console.error("HLS fatal error:", data);

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.log("HLS network error, attempting to recover...");
          try {
            hls.startLoad();
          } catch (error) {
            console.error("Failed to recover from network error:", error);
            if (onError) onError(data);
          }
          break;

        case Hls.ErrorTypes.MEDIA_ERROR:
          console.log("HLS media error, attempting to recover...");
          try {
            hls.recoverMediaError();
          } catch (error) {
            console.error("Failed to recover from media error:", error);
            if (onError) onError(data);
          }
          break;

        default:
          console.error("HLS fatal error, cannot recover:", data);
          if (fallbackUrl) {
            console.log("Attempting to load fallback URL:", fallbackUrl);
            hls.loadSource(fallbackUrl);
            hls.startLoad();
          } else if (onError) {
            onError(data);
          }
          break;
      }
    }
  });
}

/**
 * Create HLS source object for Video.js
 */
export function createHLSSource(manifestUrl: string, type: string = "application/x-mpegURL"): { src: string; type: string } {
  return {
    src: manifestUrl,
    type,
  };
}

/**
 * Check if a URL is an HLS manifest
 */
export function isHLSManifest(url: string): boolean {
  return url.includes(".m3u8") || url.includes("application/x-mpegURL") || url.includes("application/vnd.apple.mpegurl");
}

export default {
  isHLSSupported,
  isNativeHLSSupported,
  initHLS,
  setupHLSForVideoJS,
  cleanupHLS,
  getHLSLevels,
  setHLSQuality,
  getCurrentHLSQuality,
  setupHLSErrorHandling,
  createHLSSource,
  isHLSManifest,
};

