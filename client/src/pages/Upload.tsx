import { useState } from "react";
import { Upload as UploadIcon, Music, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      formData.append("artist", artist || "Unknown Artist");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your music has been uploaded successfully",
      });
      setFile(null);
      setTitle("");
      setArtist("");
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith("audio/")) {
        toast({
          title: "Invalid file",
          description: "Please select an audio file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      // Auto-fill title from filename
      const filename = selectedFile.name.replace(/\.[^/.]+$/, "");
      if (!title) setTitle(filename);
    }
  };

  return (
    <div className="min-h-screen pb-32 px-6 pt-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-8">Upload Music</h1>

        <Card className="p-8">
          {/* File Upload Area */}
          <div className="mb-8">
            <Label htmlFor="file-upload" className="block mb-2">
              Music File
            </Label>
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover-elevate transition-all">
              {file ? (
                <div className="space-y-4">
                  <Music className="h-16 w-16 text-primary mx-auto" />
                  <div>
                    <p className="text-foreground font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFile(null)}
                    data-testid="button-remove-file"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer block"
                >
                  <UploadIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-foreground font-medium mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-muted-foreground">
                    MP3, WAV, OGG, or other audio formats
                  </p>
                </label>
              )}
              <input
                id="file-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-file"
              />
            </div>
          </div>

          {/* Metadata Form */}
          <div className="space-y-6">
            <div>
              <Label htmlFor="title">Track Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter track title"
                className="mt-2"
                data-testid="input-title"
              />
            </div>

            <div>
              <Label htmlFor="artist">Artist</Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Enter artist name"
                className="mt-2"
                data-testid="input-artist"
              />
            </div>

            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={!file || uploadMutation.isPending}
              className="w-full"
              data-testid="button-upload"
            >
              {uploadMutation.isPending ? (
                <>Uploading...</>
              ) : (
                <>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Upload Music
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Tips */}
        <div className="mt-8 p-6 bg-muted/50 rounded-lg">
          <h3 className="font-medium text-foreground mb-2">Tips:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Supported formats: MP3, WAV, OGG, FLAC, AAC</li>
            <li>• Maximum file size: 50 MB</li>
            <li>• Add accurate metadata for better organization</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
