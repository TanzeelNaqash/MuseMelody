import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LyricsPanel } from "@/components/LyricsPanel";
import { useRouter } from "wouter";

export default function Lyrics() {
  const [, navigate] = useRouter();

  return (
    <div className="min-h-screen pb-32">
      <div className="p-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          data-testid="button-back-lyrics"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      <LyricsPanel />
    </div>
  );
}
