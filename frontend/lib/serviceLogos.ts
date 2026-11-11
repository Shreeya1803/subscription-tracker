/**
 * Well-known services and their websites. The app shows the website's own icon (fetched from
 * Google's public favicon service) so a subscription is easy to recognise. Only the website name is
 * sent, never anything about the user. Unknown names fall back to a coloured letter tile.
 */
const SERVICES: Array<{ match: RegExp; domain: string }> = [
  { match: /netflix/, domain: 'netflix.com' },
  { match: /spotify/, domain: 'spotify.com' },
  { match: /youtube/, domain: 'youtube.com' },
  { match: /prime video|amazon prime|^prime$/, domain: 'primevideo.com' },
  { match: /audible/, domain: 'audible.com' },
  { match: /kindle/, domain: 'amazon.com' },
  { match: /amazon/, domain: 'amazon.com' },
  { match: /disney|hotstar/, domain: 'disneyplus.com' },
  { match: /icloud/, domain: 'icloud.com' },
  { match: /apple music/, domain: 'music.apple.com' },
  { match: /apple tv/, domain: 'tv.apple.com' },
  { match: /apple one|apple arcade|apple/, domain: 'apple.com' },
  { match: /google one|google drive/, domain: 'one.google.com' },
  { match: /chatgpt|openai/, domain: 'openai.com' },
  { match: /claude|anthropic/, domain: 'claude.ai' },
  { match: /microsoft|office 365|xbox|onedrive/, domain: 'microsoft.com' },
  { match: /adobe|photoshop|lightroom|acrobat/, domain: 'adobe.com' },
  { match: /canva/, domain: 'canva.com' },
  { match: /dropbox/, domain: 'dropbox.com' },
  { match: /notion/, domain: 'notion.so' },
  { match: /slack/, domain: 'slack.com' },
  { match: /zoom/, domain: 'zoom.us' },
  { match: /figma/, domain: 'figma.com' },
  { match: /github/, domain: 'github.com' },
  { match: /linkedin/, domain: 'linkedin.com' },
  { match: /duolingo/, domain: 'duolingo.com' },
  { match: /hbo|^max$/, domain: 'max.com' },
  { match: /paramount/, domain: 'paramountplus.com' },
  { match: /stan\b/, domain: 'stan.com.au' },
  { match: /binge/, domain: 'binge.com.au' },
  { match: /kayo/, domain: 'kayosports.com.au' },
  { match: /foxtel/, domain: 'foxtel.com.au' },
  { match: /telstra/, domain: 'telstra.com.au' },
  { match: /optus/, domain: 'optus.com.au' },
  { match: /zee5/, domain: 'zee5.com' },
  { match: /sony ?liv/, domain: 'sonyliv.com' },
  { match: /jio/, domain: 'jio.com' },
  { match: /airtel/, domain: 'airtel.in' },
  { match: /swiggy/, domain: 'swiggy.com' },
  { match: /zomato/, domain: 'zomato.com' },
  { match: /uber/, domain: 'uber.com' },
  { match: /tinder/, domain: 'tinder.com' },
  { match: /nyt|new york times/, domain: 'nytimes.com' },
  { match: /medium/, domain: 'medium.com' },
  { match: /patreon/, domain: 'patreon.com' },
  { match: /playstation|ps plus/, domain: 'playstation.com' },
  { match: /nintendo/, domain: 'nintendo.com' },
  { match: /crunchyroll/, domain: 'crunchyroll.com' },
  { match: /twitch/, domain: 'twitch.tv' },
  { match: /x premium|twitter/, domain: 'x.com' },
];

/** Icon URL for a known service name, or null (then the app shows a letter tile). */
export function serviceLogoUrl(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const hit = SERVICES.find((s) => s.match.test(key));
  return hit ? `https://www.google.com/s2/favicons?domain=${hit.domain}&sz=128` : null;
}

const TILE_COLORS = ['#E5484D', '#30A46C', '#5B8DEF', '#E38A2B', '#8E4EC6', '#12A594', '#D6409F', '#3E63DD'];

/** A stable colour per name for the letter tile (the same service always gets the same colour). */
export function tileColor(name: string) {
  let hash = 0;
  for (const ch of name.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}
