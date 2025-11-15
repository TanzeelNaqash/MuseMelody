import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LyricsPanel } from "@/components/LyricsPanel";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export default function Lyrics() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen pb-32">
      <div className="p-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          data-testid="button-back-lyrics"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
      </div>
      <LyricsPanel />
    </div>
  );
}
