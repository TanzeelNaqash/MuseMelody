import React from "react";
import { motion } from "framer-motion";
import { 
  FileSignature, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  UserCog, 
  Code2,
  Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function UserAgreement() {
  const [, navigate] = useLocation();

  const agreements = [
    {
      icon: <Code2 className="h-5 w-5 text-blue-500 dark:text-blue-400" />,
      title: "1. Developer Project Acknowledgement",
      content: (
        <p>
          You acknowledge that <strong>MuseMelody</strong> is a personal portfolio project developed by <strong>Tanzeel Naqash</strong>. It is designed for educational purposes to demonstrate web development capabilities. It is not a commercial product, has no advertisements, and offers no paid subscriptions.
        </p>
      ),
    },
    {
      icon: <UserCog className="h-5 w-5 text-purple-500 dark:text-purple-400" />,
      title: "2. Account Usage",
      content: (
        <div className="space-y-2">
          <p>By creating an account or using Guest Mode, you agree that:</p>
          <ul className="list-none space-y-2 text-muted-foreground">
            <li className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 shrink-0" />
              <span>You will not use this application for any illegal activities.</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 shrink-0" />
              <span>You understand that data is synced via Google/Email solely for your convenience.</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      icon: <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />,
      title: "3. Prohibited Conduct",
      content: (
        <p>
          You agree not to attempt to reverse engineer the API, spam the service, or exploit any vulnerabilities found within the application. As this is an open-source learning project, we ask that you treat the infrastructure with respect.
        </p>
      ),
    },
    {
      icon: <FileSignature className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />,
      title: "4. Liability Waiver",
      content: (
        <p>
          By using MuseMelody, you agree to hold the developer (Tanzeel Naqash) harmless from any claims, damages, or losses resulting from the use of this application. This includes, but is not limited to, potential playback errors, data syncing issues, or temporary service outages caused by third-party API changes.
        </p>
      ),
    },
  ];

  return (
    // 👇 FIXED: Added `pb-24` to ensure footer clears the mobile navigation bar
    <div className="min-h-screen w-full bg-background relative overflow-hidden pb-24 md:pb-0">
      
      {/* Background Ambience - Adaptive */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.1),transparent_40%)] dark:bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.15),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] dark:opacity-[0.05]" />

      <div className="relative mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-20">
        
        {/* Header */}
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
              <FileSignature className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                User Agreement
              </h1>
              <p className="text-sm text-muted-foreground">
                Agreement for use of MuseMelody
              </p>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <div className="grid gap-6">
          {agreements.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              // 👇 FIXED: Used `p-5` for mobile (better spacing) and `md:p-8` for desktop
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/50 p-5 md:p-8 backdrop-blur-sm transition-colors hover:bg-card/80 hover:border-primary/20 shadow-sm"
            >
              <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background border border-border shadow-sm group-hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    {item.title}
                  </h2>
                  <div className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    {item.content}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Acceptance Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center p-6 rounded-2xl border border-border bg-primary/5"
        >
          <p className="text-sm text-muted-foreground">
            By continuing to use MuseMelody, you acknowledge that you have read, understood, and agree to be bound by this User Agreement.
          </p>
        </motion.div>

      </div>
    </div>
  );
}