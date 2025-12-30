import { Home, Search, Library, Plus, Upload } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import React from "react";

const menuItems = [
  { title: "Home", url: "/", icon: Home, testId: "nav-home" },
  { title: "Search", url: "/search", icon: Search, testId: "nav-search" },
  { title: "Library", url: "/library", icon: Library, testId: "nav-library" },
];

const libraryItems = [
  { title: "Create Playlist", url: "/create-playlist", icon: Plus, testId: "nav-create-playlist" },
  { title: "Upload Music", url: "/upload", icon: Upload, testId: "nav-upload" },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();

  // Helper to check if a route is active (handles exact matches and sub-routes)
  const isActiveRoute = (url: string) => {
    if (url === "/") {
      return location === "/";
    }
    return location.startsWith(url);
  };

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    setLocation(url);
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
        <SidebarGroupLabel className="text-base font-bold px-4 py-3 mb-6 h-auto">
  <div className="flex items-center gap-2">
    <img
      src="/logo.png"
      alt="MuseMelody"
      className="h-12 w-12 object-contain"
    />
    <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent 
                   bg-gradient-to-r 
                   from-[#D65D6A] via-[#E68AA1] to-[#D65D6A]
                   dark:from-[#FF9A9E] dark:via-[#FECFEF] dark:to-[#FF9A9E]
                   drop-shadow-sm">
      MuseMelody
    </h1>
  </div>
</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = isActiveRoute(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={item.testId}
                    >
                      <a href={item.url} onClick={(e) => handleNavigation(e, item.url)}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Your Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {libraryItems.map((item) => {
                const isActive = isActiveRoute(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      data-testid={item.testId}
                    >
                      <a href={item.url} onClick={(e) => handleNavigation(e, item.url)}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
