/**
 * Application configuration utilities
 * Handles environment-specific settings like domain URLs
 */

/**
 * Get the application base URL
 * Uses VITE_APP_URL if set, otherwise falls back to window.location.origin
 * This ensures password reset and other redirects work correctly in production
 */
export function getAppUrl(): string {
  // In production, set VITE_APP_URL to your domain (e.g., https://tutorprep.co.za)
  const envUrl = import.meta.env.VITE_APP_URL;
  
  if (envUrl) {
    // Remove trailing slash if present
    return envUrl.replace(/\/$/, '');
  }
  
  // Fallback to current origin (works in development and if env var not set)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Server-side fallback (shouldn't happen in this app, but just in case)
  return '';
}

/**
 * Get the full URL for a given path
 * @param path - The path to append (should start with /)
 * @returns Full URL with domain
 */
export function getAppUrlForPath(path: string): string {
  const baseUrl = getAppUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD || import.meta.env.MODE === 'production';
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
}
