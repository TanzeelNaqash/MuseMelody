import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VideoModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignVideoRef: (node: HTMLVideoElement | null) => void;
  isVideoActive: boolean;
  isMuted: boolean;
  thumbnail?: string | null;
  title?: string | null;
  artist?: string | null;
  onDisableVideo: () => void;
};

export function VideoModal({
  open,
  onOpenChange,
  assignVideoRef,
  isVideoActive,
  isMuted,
  thumbnail,
  title,
  artist,
  onDisableVideo,
}: VideoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-4 overflow-hidden bg-background/90 p-0 backdrop-blur-xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-base font-semibold text-foreground">
            {title || "Now Playing"}
          </DialogTitle>
          {artist && <p className="text-sm text-muted-foreground">{artist}</p>}
        </DialogHeader>
        <div className="px-6 pb-6">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black/80">
            {isVideoActive ? (
              <video
                ref={assignVideoRef}
                className="h-full w-full object-cover"
                playsInline
                muted={isMuted}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                {thumbnail ? (
                  <img src={thumbnail} alt={title ?? "thumbnail"} className="h-full w-full object-cover" />
                ) : (
                  <div className="text-sm text-muted-foreground">Video will appear once available</div>
                )}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="hidden text-sm text-muted-foreground sm:block">
              {title || "Now Playing"}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="rounded-full border border-border/40 px-4" onClick={onDisableVideo}>
                Audio Only
              </Button>
              <Button variant="ghost" className="rounded-full border border-border/40 px-4" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
