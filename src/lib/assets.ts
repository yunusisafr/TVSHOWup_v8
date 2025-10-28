// Central management for assets like logos, images, etc.

// Increment this version number whenever you update the logo
// This helps bypass browser caching when updating the logo
export const LOGO_VERSION = 2;

/**
 * Get the URL for the TVSHOWup logo with cache-busting
 * @param variant Optional variant of the logo (e.g., '01', '02')
 * @returns The URL to the logo with a version parameter for cache-busting
 */
export const getLogoUrl = (variant: string = '01'): string => {
  return `/tvshowup_logo-01.png?v=${LOGO_VERSION}`;
};

/**
 * Get the URL for any asset with cache-busting
 * @param path Path to the asset relative to the public directory
 * @param version Optional version number for cache-busting (defaults to 1)
 * @returns The URL to the asset with a version parameter for cache-busting
 */
export const getAssetUrl = (path: string, version: number = 1): string => {
  return `${path}?v=${version}`;
};