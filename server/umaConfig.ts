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
    'https://piped.eu.projectsegfau.lt',
    'https://piped.us.projectsegfau.lt',
    'https://piped.lunar.icu',
  ],
  hls: [],
  proxy: [],
  invidious: [
    'https://inv.nadeko.net',
    'https://y.com.sb',
    'https://iv.melmac.space',
    'https://zoomerville.com',
    'https://inv.perditum.com',
    'https://inv.vern.cc',
    'https://invidious.nikkosphere.com',
    'https://invidious.materialio.us',
  ],
  hyperpipe: [
    'https://hyperpipeapi.darkness.services',
    'https://hyperpipeapi.onrender.com',
    'https://hyperpipebackend.eu.projectsegfau.lt',
    'https://hyperpipebackend.in.projectsegfau.lt',
  ],
  jiosaavn: 'https://jiosavan-ytify.vercel.app',
  health: 'N',
};

