import { Music, Play, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card">
      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary)/0.05),transparent_50%)]" />
        
        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <div className="flex justify-center mb-6">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Music className="h-12 w-12 text-primary" />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-4">
            Your Music,
            <span className="text-primary"> Everywhere</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Stream millions of songs from YouTube, upload your own tracks, and enjoy seamless playback with real-time lyrics
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
              size="lg"
              onClick={() => window.location.href = '/api/login'}
              className="text-lg px-8 h-14 bg-primary hover:bg-primary/90"
              data-testid="button-login"
            >
              Get Started
              <Play className="ml-2 h-5 w-5" fill="currentColor" />
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 py-24">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-16">
          Everything You Need
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-lg bg-card border border-card-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Search & Stream
            </h3>
            <p className="text-muted-foreground">
              Access millions of songs from YouTube with instant search and high-quality streaming
            </p>
          </div>

          <div className="p-6 rounded-lg bg-card border border-card-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Upload Your Music
            </h3>
            <p className="text-muted-foreground">
              Upload and play your personal music collection alongside YouTube tracks
            </p>
          </div>

          <div className="p-6 rounded-lg bg-card border border-card-border">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Music className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Real-Time Lyrics
            </h3>
            <p className="text-muted-foreground">
              Sing along with synchronized lyrics for your favorite songs
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
          Ready to start listening?
        </h2>
        <p className="text-xl text-muted-foreground mb-8">
          Join now and create your personalized music experience
        </p>
        <Button
          size="lg"
          onClick={() => window.location.href = '/api/login'}
          className="text-lg px-8 h-14 bg-primary hover:bg-primary/90"
          data-testid="button-cta-login"
        >
          Sign In to Continue
        </Button>
      </div>
    </div>
  );
}
