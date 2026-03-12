export function createPrivateCacheHeaders(maxAgeSeconds = 30, staleWhileRevalidateSeconds = 60): HeadersInit {
  return {
    'Cache-Control': `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
    Vary: 'Cookie',
  };
}

export function createNoStoreHeaders(): HeadersInit {
  return {
    'Cache-Control': 'private, no-store',
    Vary: 'Cookie',
  };
}
