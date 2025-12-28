export interface JioSaavnSong {
    title: string;
    url: string;
    image?: string;
    primaryArtists?: string;
    downloadUrl?: {
      quality: string;
      url: string;
    }[];
  }
  
  interface JioSaavnSearchResponse {
    success: boolean;
    data?: {
      songs?: {
        results?: JioSaavnSong[];
      };
    };
  }
  
  const SAAVN_BASE = 'https://saavn-ytify.vercel.app';
  
  export async function resolveFromJioSaavn(
    query: string,
  ): Promise<{
    url: string;
    mimeType: string;
    audioStreams: any[];
  }> {
    const res = await fetch(
      `${SAAVN_BASE}/api/search/songs?query=${encodeURIComponent(query)}`,
      { cache: 'no-store' },
    );
  
    if (!res.ok) {
      throw new Error('JioSaavn search failed');
    }
  
    const json = (await res.json()) as JioSaavnSearchResponse;
    const song = json?.data?.songs?.results?.[0];
  
    if (!song || !song.downloadUrl?.length) {
      throw new Error('No JioSaavn result');
    }
  
    // Prefer highest quality
    const best =
      song.downloadUrl.find((d) => d.quality === '320kbps') ??
      song.downloadUrl[song.downloadUrl.length - 1];
  
    if (!best?.url) {
      throw new Error('No downloadable audio');
    }
  
    return {
      url: best.url,
      mimeType: 'audio/mpeg',
      audioStreams: [
        {
          bitrate: 320000,
          codec: 'mp3',
          quality: best.quality,
          mimeType: 'audio/mpeg',
          url: best.url,
        },
      ],
    };
  }
  