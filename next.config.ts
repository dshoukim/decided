import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: [
      'assets.nflxext.com',
      'upload.wikimedia.org',
      'cnbl-cdn.bamgrid.com',
      'm.media-amazon.com',
      'www.hulu.com',
      'play-lh.googleusercontent.com',
      'www.apple.com',
      'wwwimage-us.pplusstatic.com',
      'www.peacocktv.com',
      'us1-prod-images.disco-api.com',
      'www.sho.com',
      'developer.spotify.com',
      'music.youtube.com',
      'tv.youtube.com',
      'a4.espncdn.com',
      'd2hq1de00mj6b4.cloudfront.net',
      'www.sling.com',
      'www.crunchyroll.com',
      'www.funimation.com',
      'compass-ssl.xbox.com',
      'www.playstation.com',
      'tubitv.com',
      'pluto.tv',
      'www.crackle.com',
      // Google user content domains for profile images
      'lh3.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
      // TMDB image domains for movie posters
      'image.tmdb.org',
      // UI Avatars service for generated profile images
      'ui-avatars.com'
    ],
  },
  webpack: (config) => {
    // Ensure the `@/` alias points to the `src` directory for both JS and TS build pipelines
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Temporarily disable type checking during development
  onDemandEntries: {
    // period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
};

export default nextConfig;
