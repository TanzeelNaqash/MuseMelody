export interface UmaConfig {
  piped: string[]
  hls: string[]
  proxy: string[]
  invidious: string[]
  hyperpipe: string[]
  jiosaavn: string
  health: 'Y' | 'N'
}

export const DEFAULT_UMA_CONFIG: UmaConfig = {
  piped: [
    'https://piped.private.coffee',
    'https://api.piped.private.coffee',
    'https://piped.video',
  
  ],
  hls: [],
  proxy: [],
  invidious: [
    "https://ytify.pp.ua",
        "https://y.com.sb",
        "https://inv.vern.cc",
        "https://invidious.materialio.us",
        "https://iv.melmac.space",
        "https://inv.perditum.com",
        "https://zoomerville.com"
  ],
  hyperpipe: [
     "https://hyperpipeapi.darkness.services",
        "https://hyperpipeapi.onrender.com"
  ],
  jiosaavn: "https://saavn-ytify.vercel.app",
  health: "Y"
};

