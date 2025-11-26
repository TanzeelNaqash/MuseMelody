import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2,
  RotateCcw,
  FileText,
  Shield,
  Info,
  History,
  Settings as SettingsIcon,
  ExternalLink,
  X,
} from "lucide-react";
import { usePlayerStore } from "@/lib/playerStore";
import { useLocation } from "wouter";

export default function Settings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { clearQueue } = usePlayerStore();
  const [, navigate] = useLocation();
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/history");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      toast({
        title: t("settings.historyCleared"),
        description: t("settings.historyClearedDesc"),
      });
      setIsClearingHistory(false);
    },
    onError: () => {
      toast({
        title: t("settings.error"),
        description: t("settings.historyClearError"),
        variant: "destructive",
      });
      setIsClearingHistory(false);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (options: {
      clearHistory: boolean;
      clearPlaylists: boolean;
      clearUploads: boolean;
    }) => {
      await apiRequest("POST", "/api/reset", options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
      clearQueue();
      toast({
        title: t("settings.dataReset"),
        description: t("settings.dataResetDesc"),
      });
      setIsResetting(false);
    },
    onError: () => {
      toast({
        title: t("settings.error"),
        description: t("settings.resetError"),
        variant: "destructive",
      });
      setIsResetting(false);
    },
  });

  const handleClearHistory = () => {
    setIsClearingHistory(true);
    clearHistoryMutation.mutate();
  };

  const handleReset = (options: {
    clearHistory: boolean;
    clearPlaylists: boolean;
    clearUploads: boolean;
  }) => {
    setIsResetting(true);
    resetMutation.mutate(options);
  };

  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  return (
    <div className="min-h-screen bg-background">
      {/* Material Design App Bar */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/40 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 -ml-2 sm:-ml-1"
              onClick={() => navigate("/")}
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="p-1.5 sm:p-2 rounded-full bg-primary/10 shrink-0">
              <SettingsIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-medium text-foreground">
              {t("settings.settings")}
            </h1>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 max-w-4xl">
        <div className="space-y-3 sm:space-y-4">
          {/* Data Management Section */}
          <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-card">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-full bg-destructive/10 shrink-0">
                  <History className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base sm:text-lg font-medium text-foreground">
                    {t("settings.dataManagement")}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {t("settings.dataManagementDesc")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-3 sm:pb-4 space-y-1 px-0">
              {/* Clear History */}
              <div className="group relative">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors duration-150">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="p-1 sm:p-1.5 rounded-full bg-destructive/10 group-hover:bg-destructive/20 transition-colors shrink-0">
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground">
                        {t("settings.clearHistory")}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">
                        {t("settings.clearHistoryDesc")}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button
  variant="ghost"
  size="sm"
  className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
  disabled={isClearingHistory}
  onClick={(e) => e.stopPropagation()}
>

                        {isClearingHistory ? (
                          <>
                            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 sm:mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            {t("settings.clearing")}
                          </>
                        ) : (
                          t("settings.clear")
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[calc(100%-2rem)] sm:max-w-md px-4 sm:px-6">
  <AlertDialogHeader>
    <div className="flex items-center gap-2 sm:gap-3 mb-2">
      <div className="p-1.5 sm:p-2 rounded-lg bg-destructive/10 shrink-0">
        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
      </div>
      <AlertDialogTitle className="text-lg sm:text-xl">
        {t("settings.clearHistoryConfirm")}
      </AlertDialogTitle>
    </div>
    <AlertDialogDescription className="text-sm sm:text-base pt-2">
      {t("settings.clearHistoryConfirmDesc")}
    </AlertDialogDescription>
  </AlertDialogHeader>

  <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
    <AlertDialogCancel className="w-full sm:w-auto order-2 sm:order-1">
      {t("settings.cancel")}
    </AlertDialogCancel>
    <AlertDialogAction
      onClick={handleClearHistory}
      className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 order-1 sm:order-2"
    >
      {t("settings.confirm")}
    </AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>

                  </AlertDialog>
                </div>
              </div>

              <div className="h-px bg-border mx-3 sm:mx-4"></div>

              {/* Reset Data */}
              <div className="group relative">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors duration-150">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="p-1 sm:p-1.5 rounded-full bg-destructive/10 group-hover:bg-destructive/20 transition-colors shrink-0">
                      <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground">
                        {t("settings.resetData")}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">
                        {t("settings.resetDataDesc")}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button
  variant="ghost"
  size="sm"
  className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
  disabled={isResetting}
  onClick={(e) => e.stopPropagation()}
>

                        {isResetting ? (
                          <>
                            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 sm:mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            {t("settings.resetting")}
                          </>
                        ) : (
                          t("settings.reset")
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent
  className="
    fixed left-1/2 top-1/2
    -translate-x-1/2 -translate-y-1/2
    w-[90vw] max-w-sm

    animate-in fade-in-50 zoom-in-95
    duration-200
  "
>
  <AlertDialogHeader>
    <div className="flex items-center gap-2 sm:gap-3 mb-2">
      <div className="p-1.5 sm:p-2 rounded-lg bg-destructive/10 shrink-0">
        <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
      </div>
      <AlertDialogTitle className="text-lg sm:text-xl">
        {t("settings.resetDataConfirm")}
      </AlertDialogTitle>
    </div>

    <AlertDialogDescription className="text-sm sm:text-base pt-2">
      {t("settings.resetDataConfirmDesc")}
    </AlertDialogDescription>
  </AlertDialogHeader>

  <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
    <AlertDialogCancel className="w-full sm:w-auto order-2 sm:order-1">
      {t("settings.cancel")}
    </AlertDialogCancel>

    <AlertDialogAction
      onClick={() =>
        handleReset({
          clearHistory: true,
          clearPlaylists: true,
          clearUploads: true,
        })
      }
      className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 order-1 sm:order-2"
    >
      {t("settings.confirm")}
    </AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>

                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legal & Information Section */}
          <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-card">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-full bg-primary/10 shrink-0">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base sm:text-lg font-medium text-foreground">
                    {t("settings.legalAndInfo")}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {t("settings.legalAndInfoDesc")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-3 sm:pb-4 space-y-1 px-0">
              {/* Privacy Policy */}
              <div className="group relative">
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors duration-150 cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="p-1 sm:p-1.5 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                      <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground">
                        {t("settings.privacy")}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">
                        {t("settings.privacyDesc")}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
                </a>
              </div>

              <div className="h-px bg-border mx-3 sm:mx-4"></div>

              {/* Terms of Service */}
              <div className="group relative">
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors duration-150 cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="p-1 sm:p-1.5 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground">
                        {t("settings.terms")}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">
                        {t("settings.termsDesc")}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
                </a>
              </div>

              <div className="h-px bg-border mx-3 sm:mx-4"></div>

              {/* Version */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="p-1 sm:p-1.5 rounded-full bg-primary/10 shrink-0">
                    <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground">
                      {t("settings.version")}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">
                      {t("settings.versionDesc")}
                    </p>
                  </div>
                </div>
                <div className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-primary/10 text-[10px] sm:text-xs font-medium text-primary shrink-0 ml-2">
                  v{appVersion}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

