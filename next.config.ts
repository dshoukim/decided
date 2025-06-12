import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  images: {
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
      'www.crackle.com'
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
};

export default nextConfig;
