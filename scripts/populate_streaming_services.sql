-- Insert popular streaming services with their logos and details
INSERT INTO public.streaming_services (name, logo_url, website_url, description, monthly_price) VALUES
-- Major US Streaming Services
('Netflix', 'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png', 'https://netflix.com', 'Movies, TV shows, and original content', 15.49),
('Disney+', 'https://cnbl-cdn.bamgrid.com/assets/7ecc8bcb60ad77193058d63e321bd21cbac2fc67e652dfa304f8bc5671c551ac.png', 'https://disneyplus.com', 'Disney, Marvel, Star Wars, and more', 13.99),
('Amazon Prime Video', 'https://m.media-amazon.com/images/G/01/digital/video/web/Logo-min.png', 'https://primevideo.com', 'Movies, TV shows, and Amazon Originals', 8.99),
('Hulu', 'https://www.hulu.com/static/hitch/s3/attachments/ckcosx8zr000201l39dc3du8y/hulu-logo-green.png', 'https://hulu.com', 'TV shows, movies, and live TV', 14.99),
('HBO Max', 'https://play-lh.googleusercontent.com/1iyX7VdQ5zpPZDcOuHEzpIBa-_hLO-V4pGlCSoqkSYU5JrWaouV2jeH_oKsqMPOWNF0', 'https://hbomax.com', 'HBO content, movies, and originals', 14.99),
('Apple TV+', 'https://www.apple.com/v/apple-tv-plus/n/images/meta/apple-tv-plus__f0gqjbt3vveq_og.png', 'https://tv.apple.com', 'Apple original movies and TV shows', 6.99),
('Paramount+', 'https://wwwimage-us.pplusstatic.com/base/files/meta/pplus_meta_og_1200x630.png', 'https://paramountplus.com', 'CBS, Paramount movies, and originals', 5.99),
('Peacock', 'https://www.peacocktv.com/dam/growth/assets/brand/peacock-logo.svg', 'https://peacocktv.com', 'NBCUniversal content and originals', 5.99),
('Discovery+', 'https://us1-prod-images.disco-api.com/2020/10/26/d17109b0-6c92-3d04-a8fe-1a8f8f1c5d1c.png', 'https://discoveryplus.com', 'Discovery Channel content and documentaries', 4.99),
('Showtime', 'https://www.sho.com/assets/images/ui/showtime-logo-red.png', 'https://showtime.com', 'Premium movies and original series', 10.99),

-- Music Streaming Services
('Spotify', 'https://developer.spotify.com/assets/branding-guidelines/icon1@2x.png', 'https://spotify.com', 'Music streaming and podcasts', 10.99),
('Apple Music', 'https://www.apple.com/v/apple-music/p/images/meta/apple-music__bfgw9qw7yjau_og.png', 'https://music.apple.com', 'Music streaming service', 10.99),
('YouTube Music', 'https://music.youtube.com/img/favicon_144.png', 'https://music.youtube.com', 'Music streaming from YouTube', 9.99),
('Amazon Music', 'https://m.media-amazon.com/images/G/01/digital/music/player/web/favicon_32x32.ico', 'https://music.amazon.com', 'Music streaming from Amazon', 8.99),

-- Live TV and Sports
('YouTube TV', 'https://tv.youtube.com/img/icons/favicons/favicon-32x32.png', 'https://tv.youtube.com', 'Live TV streaming service', 64.99),
('ESPN+', 'https://a4.espncdn.com/combiner/i?img=%2Fi%2Fespn%2Fmisc_logos%2F500%2Fespn_plus.png', 'https://espnplus.com', 'Sports streaming and exclusive content', 9.99),
('FuboTV', 'https://d2hq1de00mj6b4.cloudfront.net/public/static/favicon-32x32.png', 'https://fubo.tv', 'Live sports and TV streaming', 74.99),
('Sling TV', 'https://www.sling.com/favicon-32x32.png', 'https://sling.com', 'Live TV streaming service', 35.00),

-- International Services
('Crunchyroll', 'https://www.crunchyroll.com/build/assets/img/favicons/favicon-32x32.png', 'https://crunchyroll.com', 'Anime streaming service', 7.99),
('Funimation', 'https://www.funimation.com/assets/build/img/favicons/favicon-32x32.png', 'https://funimation.com', 'Anime streaming service', 5.99),

-- Gaming Services
('Xbox Game Pass', 'https://compass-ssl.xbox.com/assets/d4/63/d463d92d-85b9-4b25-9c12-41040d53b8e4.png', 'https://xbox.com/game-pass', 'Gaming subscription service', 14.99),
('PlayStation Plus', 'https://www.playstation.com/content/dam/global_pdc/en/web/dev24/brand/playstation-logo-16x16.png', 'https://playstation.com/plus', 'Gaming subscription service', 17.99),

-- Free Services (with ads)
('Tubi', 'https://tubitv.com/favicon.ico', 'https://tubitv.com', 'Free movies and TV shows', 0.00),
('Pluto TV', 'https://pluto.tv/favicon.ico', 'https://pluto.tv', 'Free live TV and on-demand', 0.00),
('Crackle', 'https://www.crackle.com/favicon.ico', 'https://crackle.com', 'Free movies and TV shows', 0.00); 