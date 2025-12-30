import React from "react";
import { motion } from "framer-motion";
import { 
  Scale, 
  ArrowLeft, 
  BookOpen, 
  Server, 
  UserCircle, 
  ShieldAlert, 
  Copyright,
  Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function TermsOfService() {
  const [, navigate] = useLocation();

  const sections = [
    {
      icon: <BookOpen className="h-5 w-5 text-blue-500 dark:text-blue-400" />,
      title: "1. Nature of Service (Educational Project)",
      content: (
        <p>
          <strong>MuseMelody</strong> is a non-commercial, open-source personal project developed by <strong>Tanzeel Naqash</strong>. This application is created solely for educational purposes to demonstrate mastery of modern web development technologies. It is <strong>not for sale</strong>, contains <strong>no advertisements</strong>, and generates no revenue. By using this service, you acknowledge that it is a portfolio project provided "as-is."
        </p>
      ),
    },
    {
      icon: <Server className="h-5 w-5 text-purple-500 dark:text-purple-400" />,
      title: "2. Content & Third-Party APIs",
      content: (
        <div className="space-y-2">
          <p>
            MuseMelody acts exclusively as a client-side interface. <strong>We do not host, store, upload, or own any music tracks, videos, or album art.</strong>
          </p>
          <p>All content streamed through this application is fetched from public, third-party APIs, specifically:</p>
          {/* 👇 FIXED: Replaced text-white/80 with text-muted-foreground */}
          <ul className="list-disc list-inside pl-2 text-muted-foreground">
            <li><strong>***** API</strong></li>
            <li><strong>*****  API</strong></li>
          </ul>
          <p>
            We do not claim ownership of any content accessed via these APIs. All rights, titles, and interests in the content belong to their respective artists, labels, and copyright holders.
          </p>
        </div>
      ),
    },
    {
      icon: <UserCircle className="h-5 w-5 text-green-500 dark:text-green-400" />,
      title: "3. User Accounts & Data",
      content: (
        <div className="space-y-2">
          <p>The application offers two modes of access:</p>
          {/* 👇 FIXED: Replaced text-white/80 with text-muted-foreground */}
          <ul className="list-disc list-inside pl-2 text-muted-foreground">
            <li><strong>Guest Mode:</strong> No personal data is collected or stored on our servers. Settings are stored locally on your device.</li>
            <li><strong>Authorized Mode:</strong> When you link an account (via Email or Google), we strictly store your <strong>Name, Email, Verification Status, User ID, and Profile Picture</strong> solely for the purpose of syncing your library and playlists.</li>
          </ul>
          <p>We <strong>do not sell</strong> or share your data with third parties or data brokers.</p>
        </div>
      ),
    },
    {
      icon: <Copyright className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />,
      title: "4. Intellectual Property",
      content: (
        <p>
          While the content streamed belongs to respective artists, the source code, design, and architecture of the MuseMelody web application are the intellectual property of <strong>Tanzeel Naqash</strong>. You may not copy, modify, or distribute the application's source code for commercial purposes without explicit permission.
        </p>
      ),
    },
    {
      icon: <ShieldAlert className="h-5 w-5 text-red-500 dark:text-red-400" />,
      title: "5. Disclaimer of Warranties",
      content: (
        <p>
          Since this application relies on third-party instances, we cannot guarantee continuous, uninterrupted access to specific songs or features. The service is provided without warranty of any kind. The developer is not liable for any data loss or service interruptions.
        </p>
      ),
    },
  ];

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* Background Ambience - Adaptive for Light/Dark */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(120,119,198,0.1),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(120,119,198,0.15),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] dark:opacity-[0.05]" />

      <div className="relative mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-20">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/settings")} 
            className="mb-6 group text-muted-foreground hover:text-primary pl-0"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Settings
          </Button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Scale className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Terms of Service
              </h1>
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Welcome to <strong>MuseMelody</strong>. Please read these terms carefully. By accessing this application, you acknowledge that this is a developer portfolio project.
          </p>
        </motion.div>

        {/* Content Sections */}
        <div className="grid gap-6">
          {sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              // 👇 FIXED: Changed fixed border/bg colors to semantic Tailwind variables
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/50 p-6 md:p-8 backdrop-blur-sm transition-colors hover:bg-card/80 hover:border-primary/20 shadow-sm"
            >
              <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background border border-border shadow-sm group-hover:scale-110 transition-transform duration-300">
                    {section.icon}
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    {section.title}
                  </h2>
                  <div className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    {section.content}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 border-t border-border pt-8 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
            <Terminal className="h-3 w-3" />
            <span>Developed by Tanzeel Naqash</span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/60">
            MuseMelody is open source. No rights reserved on the music content.
          </p>
        </motion.div>

      </div>
    </div>
  );
}