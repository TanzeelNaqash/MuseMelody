import React from "react";
import { motion } from "framer-motion";
import { Shield, Server, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function PrivacyPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen w-full bg-background p-4 pb-24 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
            <p className="text-muted-foreground">Transparency regarding MuseMelody</p>
          </div>
        </div>

        {/* Content Area */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-3xl border border-white/10 bg-card/50 p-6 backdrop-blur-xl md:p-10"
        >
          <PrivacyContent />
        </motion.div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} MuseMelody. Developed by Tanzeel Naqash.</p>
        </div>
      </div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-8 text-foreground">
      <section>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold">Privacy Policy</h2>
        </div>
        <p className="leading-relaxed text-muted-foreground">
          Your privacy is critically important to us. MuseMelody is a developer project designed to demonstrate web development mastery. We are not in the business of selling your data. This app is ad-free and open to use.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-white/5 p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <User className="h-4 w-4 text-primary" /> Data We Collect
          </h3>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Guest Users:</span> No personal data is collected. Settings are stored locally on your device.
            </li>
            <li>
              <span className="text-foreground font-medium">Registered Users:</span> When you link an account via Google or Email, we store your Name, Email Address, Profile Picture, and User ID strictly for authentication and playlist syncing.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/5 p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Server className="h-4 w-4 text-primary" /> Third-Party Services
          </h3>
          <p className="text-sm text-muted-foreground">
            MuseMelody acts as a client interface. We do not host media files. Data is fetched from:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li><span className="text-foreground">****** & ***** APIs:</span> For streaming audio and video data.</li>
            <li><span className="text-foreground">Google OAuth:</span> For secure sign-in verification.</li>
          </ul>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">How We Use Your Data</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We use the collected information solely to provide the functionality of the app, such as maintaining your library, verifying your identity, and syncing your preferences across devices. <strong>We do not sell, trade, or rent your personal identification information to others.</strong>
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Data Deletion</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You retain full control over your data. You may request the deletion of your account and all associated data at any time by contacting the developer or using the delete option within the profile settings.
        </p>
      </section>
    </div>
  );
}