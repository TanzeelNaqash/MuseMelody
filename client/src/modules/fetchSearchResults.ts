export interface LegacyStreamItem {
  id: string
  title: string
  artist?: string
  thumbnailUrl?: string
  duration?: number
  source: 'youtube' | 'local'
}

/**
 * Legacy placeholder retained for backwards compatibility with older
 * modules. New UI components fetch search data via Uma-managed APIs.
 */
export async function fetchSearchResults(_query: string): Promise<LegacyStreamItem[]> {
  return []
}


