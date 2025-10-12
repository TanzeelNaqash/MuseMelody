# Design Guidelines: Music Streaming Application

## Design Approach: Reference-Based (YouTube Music)

**Primary Reference:** YouTube Music  
**Rationale:** User specifically requested YouTube Music UI patterns. This experience-focused, visual-rich application requires design that emphasizes content discovery, emotional engagement through album art, and seamless playback controls.

**Key Principles:**
- Content-first design with prominent imagery (album art, artist photos)
- Smooth, continuous playback experience with persistent player controls
- Dark mode as primary theme with light mode support
- Material Design influenced with custom music-specific patterns

---

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary):**
- Background Primary: `0 0% 7%` (deep charcoal)
- Background Secondary: `0 0% 11%` (elevated surfaces)
- Background Tertiary: `0 0% 15%` (cards, hover states)
- Text Primary: `0 0% 95%` (high contrast)
- Text Secondary: `0 0% 70%` (muted)
- Accent Primary: `0 85% 60%` (YouTube red for CTAs, active states)
- Accent Hover: `0 85% 55%` (slightly darker red)

**Light Mode:**
- Background Primary: `0 0% 100%` (pure white)
- Background Secondary: `0 0% 97%` (subtle gray)
- Background Tertiary: `0 0% 95%` (elevated surfaces)
- Text Primary: `0 0% 13%` (dark gray)
- Text Secondary: `0 0% 40%` (medium gray)
- Accent Primary: `0 85% 50%` (YouTube red)
- Accent Hover: `0 85% 45%`

### B. Typography

**Font Families:**
- Primary: 'Roboto' (via Google Fonts CDN) - body text, UI elements
- Headings: 'Roboto' with varied weights (300, 400, 500, 700)

**Hierarchy:**
- Hero/Page Titles: text-3xl to text-4xl font-bold
- Section Headings: text-xl to text-2xl font-semibold  
- Card Titles: text-base to text-lg font-medium
- Body/Metadata: text-sm to text-base font-normal
- Captions: text-xs font-normal text-secondary

### C. Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: space-y-8 to space-y-12
- Grid gaps: gap-4 to gap-6
- Container max-width: max-w-7xl with px-4 to px-6

**Grid Systems:**
- Mobile: Single column, stack everything
- Tablet: 2-column grids for playlists/albums (grid-cols-2)
- Desktop: 3-6 column grids (grid-cols-3 to grid-cols-6) for album/playlist cards

### D. Component Library

**Navigation:**
- Top Nav: Fixed header with search bar, logo, user avatar (h-16)
- Bottom Nav (Mobile): 4-5 icons with labels, fixed bottom, h-16
- Sidebar (Desktop): Fixed left sidebar, w-64, collapsible

**Player Controls:**
- Persistent Bottom Player Bar: h-20 to h-24, fixed bottom, elevated above content
- Contains: Album art (square, 64px), track info, playback controls, volume, queue toggle
- Mini Player: Appears on scroll, compact version with essential controls

**Content Cards:**
- Album/Playlist Cards: Square album art, title, artist/creator, play button overlay on hover
- Song List Items: Thumbnail (48px square), title, artist, duration, three-dot menu
- Trending Cards: Larger format with gradient overlays, text on image

**Forms & Inputs:**
- Search Bar: Rounded (rounded-full), elevated, with icon prefix
- Buttons: Primary (red accent), Secondary (outline), Ghost (text only)
- Use rounded-lg for most UI elements, rounded-full for pills/search

**Data Display:**
- Queue List: Draggable items with reorder handles, compact spacing
- Lyrics Panel: Centered text, auto-scroll, highlight active line
- History Grid: Timeline-based with date separators

**Overlays & Modals:**
- Full-Screen Player: Expanded view with large album art, gradient background based on art colors
- Playlist Modals: Centered, max-w-md, backdrop blur
- Context Menus: Dropdown from three-dot icons, rounded-lg, shadow-xl

### E. Imagery & Visual Treatment

**Album Art:**
- Use as primary visual anchor throughout the app
- Sizes: 48px (list items), 160px (cards), 320px+ (player view)
- Always use rounded corners (rounded-md for cards, rounded-lg for larger)
- Extract colors from album art for gradient backgrounds in full-screen player

**Hero Section:**
- Full-width featured playlist/album carousel
- Large album art (400px+) with gradient overlay
- Prominent CTA: "Play All" button with blurred background (backdrop-blur-md)

**Background Effects:**
- Use subtle radial gradients in dark mode for depth
- Blur effects behind modals and floating player controls (backdrop-blur-sm to backdrop-blur-md)
- Avoid heavy animations - keep to smooth opacity/transform transitions (300ms ease)

### F. Responsive Breakpoints

- Mobile: < 768px (bottom nav, stacked layout)
- Tablet: 768px - 1024px (2-column grids, condensed sidebar)
- Desktop: > 1024px (full sidebar, multi-column grids)

### G. Interaction Patterns

**Playback:**
- Click album/song: Immediate playback, player bar slides up
- Hover over cards: Show play button overlay with smooth fade
- Progress bar: Interactive seek with preview on hover

**Navigation:**
- Smooth page transitions with fade effects
- Maintain player state across all pages
- Bottom player bar persists, never hides

**Micro-interactions:**
- Like/Save buttons: Scale bounce effect on click
- Volume slider: Show on hover with smooth slide-in
- Queue items: Smooth reorder with drag handles

---

## Images

**Hero Section:** Large carousel with album art from trending playlists (minimum 5-6 featured items), gradient overlays, autoplay enabled

**Content Images:** Album covers for all playlists, songs, and artists - fetched from YouTube thumbnails in high resolution (minimum 480x480px)

**Placeholder Strategy:** Use dominant color blur for loading states, never show broken images