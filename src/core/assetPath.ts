/** Resolve public assets using Vite's configured base, including nested deployments. */
export function assetPath(path: string): string {
  return assetPathForBase(import.meta.env.BASE_URL, path);
}

export function assetPathForBase(baseUrl: string, path: string): string {
  const normalized = path.replace(/^\/+/, '');
  const assetPath = normalized.startsWith('assets/') ? normalized : `assets/${normalized}`;
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${assetPath}`;
}
