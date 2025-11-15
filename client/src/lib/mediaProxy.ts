const WSRV_BASE = 'https://wsrv.nl/?url=';

interface ProxyOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill';
  dpr?: number;
  defaultImage?: string;
}

export function toProxyImage(url?: string | null, options: ProxyOptions = {}): string {
  if (!url) {
    return options.defaultImage ?? '/placeholder.svg';
  }

  const encodedUrl = encodeURIComponent(url);
  const params = new URLSearchParams();
  if (options.width) params.set('w', String(options.width));
  if (options.height) params.set('h', String(options.height));
  if (options.fit) params.set('fit', options.fit);
  if (options.dpr) params.set('dpr', String(options.dpr));

  const query = params.toString();
  return `${WSRV_BASE}${encodedUrl}${query ? `&${query}` : ''}`;
}

