import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getWhatsAppStatus,
  connectWhatsApp,
  disconnectWhatsApp,
  startCampaign,
  stopCampaign
} from './whatsappBot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const CRM_FILE = path.join(DATA_DIR, 'crm_leads.json');

// Ensure data directory and crm_leads.json exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(CRM_FILE)) {
  fs.writeFileSync(CRM_FILE, JSON.stringify([], null, 2), 'utf-8');
}

const CONTACTED_FILE = path.join(DATA_DIR, 'contacted_history.json');
if (!fs.existsSync(CONTACTED_FILE)) {
  fs.writeFileSync(CONTACTED_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// Helpers for permanent contacted history JSON storage (NEVER deleted)
function readContactedFile() {
  try {
    const raw = fs.readFileSync(CONTACTED_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function writeContactedFile(records) {
  try {
    fs.writeFileSync(CONTACTED_FILE, JSON.stringify(records, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Contacted File Write Error]:', err);
    return false;
  }
}

function cleanPhoneDigitsServer(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits || digits.length < 6) return '';
  if (digits.startsWith('549')) digits = digits.slice(3);
  else if (digits.startsWith('54')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length >= 10 && digits.includes('15')) {
    digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  }
  return digits;
}

// In-Memory Query Cache with tight bounds (TTL: 60 minutes, max 25 queries)
const queryCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60;

function getCachedResults(query) {
  const key = query.toLowerCase().trim();
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  return JSON.parse(JSON.stringify(entry.data));
}

function setCachedResults(query, data) {
  const key = query.toLowerCase().trim();
  // Store cloned plain data
  queryCache.set(key, { 
    timestamp: Date.now(), 
    data: JSON.parse(JSON.stringify(data)) 
  });
  
  // Evict oldest entries if exceeding capacity
  while (queryCache.size > 25) {
    const oldestKey = queryCache.keys().next().value;
    queryCache.delete(oldestKey);
  }
}

// Helpers for CRM JSON storage
function readCrmFile() {
  try {
    const raw = fs.readFileSync(CRM_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function writeCrmFile(leads) {
  fs.writeFileSync(CRM_FILE, JSON.stringify(leads, null, 2), 'utf-8');
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Known social and aggregator domain keywords for classification
const SOCIAL_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'linktr.ee',
  'wa.me',
  'api.whatsapp.com',
  'pedix.app',
  'cafecito.app',
  'tiktok.com',
  'm.facebook.com'
];

/**
 * Classify website status
 */
function classifyWebsite(websiteUri) {
  if (!websiteUri || typeof websiteUri !== 'string' || websiteUri.trim() === '') {
    return {
      status: 'SIN WEB',
      classification: {
        type: 'NO_WEB',
        label: 'Sin Sitio Web',
        color: 'red',
        badgeBg: 'bg-rose-500/10',
        badgeBorder: 'border-rose-500/30',
        badgeText: 'text-rose-400',
        dotColor: 'bg-rose-500',
        priority: 'Prioridad Alta',
        priorityLevel: 1,
        hint: 'Oportunidad de oro: no tienen presencia web propia.'
      }
    };
  }

  const normalized = websiteUri.toLowerCase();
  const isSocial = SOCIAL_DOMAINS.some(domain => normalized.includes(domain));

  if (isSocial) {
    let platform = 'Redes Sociales';
    if (normalized.includes('instagram.com')) platform = 'Instagram';
    else if (normalized.includes('facebook.com') || normalized.includes('fb.com')) platform = 'Facebook';
    else if (normalized.includes('linktr.ee')) platform = 'Linktree';
    else if (normalized.includes('wa.me')) platform = 'WhatsApp';
    else if (normalized.includes('pedix.app')) platform = 'Pedix Menu';
    else if (normalized.includes('cafecito.app')) platform = 'Cafecito';
    else if (normalized.includes('tiktok.com')) platform = 'TikTok';

    return {
      status: 'SOLO REDES',
      classification: {
        type: 'SOCIAL_ONLY',
        label: `Solo ${platform}`,
        color: 'amber',
        badgeBg: 'bg-amber-500/10',
        badgeBorder: 'border-amber-500/30',
        badgeText: 'text-amber-400',
        dotColor: 'bg-amber-400',
        priority: 'Prioridad Media-Alta',
        priorityLevel: 2,
        platform,
        hint: `Usan ${platform} como web improvisada. Ideal para ofrecerles una web profesional.`
      }
    };
  }

  return {
    status: 'CON WEB',
    classification: {
      type: 'HAS_WEB',
      label: 'Web Propia',
      color: 'emerald',
      badgeBg: 'bg-emerald-500/10',
      badgeBorder: 'border-emerald-500/30',
      badgeText: 'text-emerald-400',
      dotColor: 'bg-emerald-400',
      priority: 'Descartable / Baja',
      priorityLevel: 3,
      hint: 'Ya poseen dominio y desarrollo propio.'
    }
  };
}

/**
 * Comprehensive phone extractor for Argentine and international formats
 */
function extractPhoneFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  // 1. Explicit tel: or phone:tel:
  const telMatch = clean.match(/(?:tel:|phone:tel:)\+?([0-9\s\-]+)/i);
  if (telMatch) {
    const raw = telMatch[1].trim();
    if (raw.replace(/\D/g, '').length >= 6) return raw;
  }

  // 2. Comprehensive regex patterns
  const phonePatterns = [
    // International / Country code: +54 ... or 54 ...
    /\+?54[\s.-]?(?:9[\s.-]?)?(?:0?[1-9]\d{1,4})[\s.-]?(?:15[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/,
    // Parenthesized area code: (0221) 456-7890, (011) 15-4567-8901
    /\(?0?[1-9]\d{1,4}\)?[\s.-]?(?:15[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/,
    // Standard local trunk: 0221 123-4567, 011 1234-5678, 0800-xxx-xxxx
    /0(?:[1-9]\d{1,3}|800|810)[\s.-]?(?:15[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/,
    // Direct area code without leading zero: 221 456-7890, 11 4567-8901
    /(?:221|11|223|341|351)[\s.-]?(?:15[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/
  ];

  for (const regex of phonePatterns) {
    const match = clean.match(regex);
    if (match) {
      const candidate = match[0].trim();
      const digits = candidate.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 14) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Extract phone, category and address from card text lines
 */
function extractDetailsFromTextLines(textLines, cardInnerText = '', defaultCity = '', defaultRubro = '') {
  let category = defaultRubro || '';
  let address = '';
  let phone = extractPhoneFromText(cardInnerText) || null;

  for (const line of (textLines || [])) {
    if (!line) continue;

    // Check for phone number if not already found
    if (!phone) {
      phone = extractPhoneFromText(line);
    }

    // Check for category and address separated by middle dot
    if (line.includes('·')) {
      const parts = line.split('·').map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (/^(cerrado|abierto|abre|cierra|temporalmente|abierto las 24 horas)/i.test(part)) continue;
        if (/^\d[,\.]\d/.test(part)) continue;
        if (extractPhoneFromText(part) && part.length < 24) continue;

        // Clean special unicode icon characters like 
        const cleanPart = part.replace(/[^\w\s\u00C0-\u00FF\.,°#\-]/gi, '').trim();
        if (!cleanPart) continue;

        if (!category && cleanPart.length < 40 && !/\d{2,}/.test(cleanPart)) {
          category = cleanPart;
        } else if (!address && (/\d+/.test(cleanPart) || /calle|av|diagonal|esquina|ruta|camino|b19/i.test(cleanPart))) {
          address = cleanPart;
        }
      }
    } else {
      if (!address && (/\d+/.test(line) || /calle|av|diagonal|esquina|ruta/i.test(line)) && !line.includes('(')) {
        if (!extractPhoneFromText(line)) {
          const clean = line.replace(/[^\w\s\u00C0-\u00FF\.,°#\-]/gi, '').trim();
          if (clean && clean.length > 5 && clean.length < 100) {
            address = clean;
          }
        }
      }
    }
  }

  return { category, address, phone };
}

/**
 * Format Argentine phone numbers to international standard (+54 9 ...)
 */
function formatArgentinePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 6) return null;

  // Case 1: Starts with 549 (already international Argentine mobile)
  if (digits.startsWith('549')) {
    let rest = digits.slice(3); // 10 digits normally, 12 if has 15
    if (rest.length === 12) {
      rest = rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    }
    return `+54 9 ${rest}`;
  }

  // Case 2: Starts with 54 (without 9)
  if (digits.startsWith('54')) {
    let rest = digits.slice(2);
    if (rest.startsWith('0')) rest = rest.slice(1);
    if (rest.length === 12) {
      rest = rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    }
    return `+54 9 ${rest}`;
  }

  // Case 3: Starts with leading 0 (national trunk)
  if (digits.startsWith('0')) {
    let rest = digits.slice(1);
    if (rest.length === 12) {
      rest = rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    }
    return `+54 9 ${rest}`;
  }

  // Case 4: 7-digit local number without area code (assume 221)
  if (digits.length === 7) {
    return `+54 9 221${digits}`;
  }

  // Case 5: 12 digits with 15
  if (digits.length === 12) {
    digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  }

  return `+54 9 ${digits}`;
}

// Global Chromium Singleton Browser Instance with Idle Auto-Shutdown
let sharedBrowser = null;
let isLaunching = false;
let browserIdleTimeout = null;
const waitingQueue = [];
const IDLE_BROWSER_TIMEOUT_MS = 1000 * 60 * 3; // 3 minutes idle -> close Chromium to free RAM

function resetBrowserIdleTimer() {
  if (browserIdleTimeout) clearTimeout(browserIdleTimeout);
  browserIdleTimeout = setTimeout(async () => {
    if (sharedBrowser && sharedBrowser.connected) {
      console.log('[Puppeteer Singleton] Browser idle for 3 minutes, shutting down to release RAM...');
      try {
        await sharedBrowser.close();
      } catch (_) {}
      sharedBrowser = null;
    }
  }, IDLE_BROWSER_TIMEOUT_MS);
}

async function getBrowser() {
  if (browserIdleTimeout) {
    clearTimeout(browserIdleTimeout);
    browserIdleTimeout = null;
  }

  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }

  if (isLaunching) {
    return new Promise((resolve, reject) => {
      waitingQueue.push({ resolve, reject });
    });
  }

  isLaunching = true;
  try {
    console.log('[Puppeteer Singleton] Spawning low-memory Chromium instance...');
    const customChromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    sharedBrowser = await puppeteer.launch({
      headless: 'new',
      ...(customChromiumPath ? { executablePath: customChromiumPath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--mute-audio',
        '--js-flags=--max-old-space-size=256',
        '--lang=es-ES,es'
      ]
    });

    sharedBrowser.on('disconnected', () => {
      console.warn('[Puppeteer Singleton] Browser disconnected, cleaning instance.');
      sharedBrowser = null;
    });

    while (waitingQueue.length > 0) {
      const { resolve } = waitingQueue.shift();
      resolve(sharedBrowser);
    }
    return sharedBrowser;
  } catch (err) {
    while (waitingQueue.length > 0) {
      const { reject } = waitingQueue.shift();
      reject(err);
    }
    throw err;
  } finally {
    isLaunching = false;
  }
}

/**
 * Core scraping function using Puppeteer Singleton
 */
async function scrapeGoogleMaps(query, targetCount = 35) {
  console.log(`[Scraper] Starting scrape for query: "${query}" (target: ${targetCount} leads)`);
  
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Intercept requests: abort images, fonts and media to cut Chromium RAM by ~80%
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 850 });

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=es`;
    console.log(`[Scraper] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    // Handle Google Consent / Cookies dialog if shown
    try {
      const consentButtons = await page.$$('button');
      for (const btn of consentButtons) {
        const text = await page.evaluate(el => el.textContent?.trim() || '', btn);
        if (/aceptar todo|rechazar todo|acepto|agree|accept all/i.test(text)) {
          console.log(`[Scraper] Dismissing consent dialog: "${text}"`);
          await btn.click();
          await new Promise(r => setTimeout(r, 1500));
          break;
        }
      }
    } catch (_) {}

    // Wait for feed container
    let feedFound = true;
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
      console.log(`[Scraper] Found results feed container`);
    } catch (e) {
      console.log(`[Scraper] Feed container not found in time, checking for single result or alternative selector...`);
      feedFound = false;
    }

    if (feedFound) {
      // Automatic scrolling to load at least 30-40 leads
      await page.evaluate(async (target) => {
        const feed = document.querySelector('div[role="feed"]');
        if (!feed) return;

        let lastHeight = feed.scrollHeight;
        let attempts = 0;
        const maxAttempts = 16;

        while (attempts < maxAttempts) {
          const cards = feed.querySelectorAll('div.Nv2PK');
          if (cards.length >= target) {
            break;
          }

          // Check if end of results reached
          const isEnd = feed.innerText.includes('Llegaste al final de la lista') ||
                        feed.innerText.includes("You've reached the end of the list");
          if (isEnd) {
            break;
          }

          feed.scrollTop = feed.scrollHeight;
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1100));

          if (feed.scrollHeight === lastHeight) {
            // Nudge up and down to trigger dynamic loading
            feed.scrollBy(0, -250);
            await new Promise(resolve => setTimeout(resolve, 300));
            feed.scrollTop = feed.scrollHeight;
            await new Promise(resolve => setTimeout(resolve, 900));
          }
          lastHeight = feed.scrollHeight;
        }
      }, targetCount);
    }

    // Extract items from feed
    const rawItems = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      const data = [];

      // If feed is available, extract all cards
      if (feed) {
        const cards = feed.querySelectorAll('div.Nv2PK');
        cards.forEach((card, index) => {
          const titleEl = card.querySelector('.qBF1Pd, a.hfpxzc, div.fontHeadlineSmall');
          const name = titleEl ? (titleEl.getAttribute('aria-label') || titleEl.textContent?.trim()) : '';
          if (!name) return;

          const linkEl = card.querySelector('a.hfpxzc') || card.querySelector('a[href*="/maps/place"]');
          const maps_url = linkEl ? linkEl.href : '';

          const ratingEl = card.querySelector('span.MW4etd');
          const rating = ratingEl ? parseFloat(ratingEl.textContent.replace(',', '.')) : null;

          const reviewsEl = card.querySelector('span.UY7F9');
          let reviews = 0;
          if (reviewsEl) {
            const match = reviewsEl.textContent.match(/\d[\d.,]*/);
            if (match) reviews = parseInt(match[0].replace(/\D/g, ''), 10) || 0;
          }

          // Website link detection
          const webEl = card.querySelector('a[data-value="Sitio web"], a[data-value="Website"], a[aria-label*="sitio web" i], a[aria-label*="website" i]');
          let website = webEl ? webEl.href : null;

          if (website && website.includes('google.com/url?q=')) {
            try {
              const urlObj = new URL(website);
              website = urlObj.searchParams.get('q') || website;
            } catch (_) {}
          }

          // Tel links inside card
          const telLinks = Array.from(card.querySelectorAll('a[href^="tel:"]')).map(a => a.href);

          // Card innerText for full snippet text
          const cardInnerText = card.innerText || '';

          // Text lines in card (.W4Efsd)
          const textLines = Array.from(card.querySelectorAll('.W4Efsd'))
            .map(el => el.textContent?.trim())
            .filter(Boolean);

          data.push({
            index,
            name,
            rating,
            reviews,
            website,
            maps_url,
            cardInnerText,
            telLinks,
            textLines
          });
        });
      } else {
        // Fallback: Check for single business detail page
        const singleTitleEl = document.querySelector('h1.DUwDvf');
        if (singleTitleEl) {
          const name = singleTitleEl.textContent?.trim();
          const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
          const rating = ratingEl ? parseFloat(ratingEl.textContent.replace(',', '.')) : null;

          const webEl = document.querySelector('a[data-item-id="authority"], a[aria-label*="sitio web" i]');
          const website = webEl ? webEl.href : null;

          const phoneBtn = document.querySelector('button[data-item-id*="phone"]');
          const phoneAria = document.querySelector('button[aria-label*="Teléfono:" i]');
          const telLink = document.querySelector('a[href^="tel:"]');
          let phone = phoneBtn ? phoneBtn.textContent.trim() : null;
          if (!phone && phoneAria) {
            const m = phoneAria.getAttribute('aria-label').match(/(?:Teléfono:\s*)?([0-9\s\+\-\(\)]+)/i);
            if (m) phone = m[1].trim();
          }
          if (!phone && telLink) {
            phone = telLink.href.replace('tel:', '').trim();
          }

          const addressBtn = document.querySelector('button[data-item-id="address"]');
          const address = addressBtn ? addressBtn.textContent.replace(/[^\w\s\u00C0-\u00FF.,°#\-/]/gi, '').trim() : '';

          data.push({
            index: 0,
            name,
            rating,
            reviews: 0,
            website,
            phone,
            maps_url: window.location.href,
            cardInnerText: `${address} ${phone || ''}`,
            telLinks: phone ? [`tel:${phone}`] : [],
            textLines: [address, phone].filter(Boolean)
          });
        }
      }

      return data;
    });

    console.log(`[Scraper] Raw leads extracted from feed: ${rawItems.length}`);

    // Initial pass: check if phone is already inside cardInnerText or textLines
    for (const item of rawItems) {
      if (item.phone) continue;
      let p = extractPhoneFromText(item.cardInnerText);
      if (!p && item.telLinks && item.telLinks.length > 0) {
        p = extractPhoneFromText(item.telLinks[0]);
      }
      if (!p && item.textLines) {
        for (const line of item.textLines) {
          p = extractPhoneFromText(line);
          if (p) break;
        }
      }
      item.phone = p;
    }

    // Detail enrichment pass: For cards missing phone or website, quickly click them to read side pane
    if (feedFound && rawItems.length > 0) {
      const missingCount = rawItems.filter(it => !it.phone).length;
      console.log(`[Scraper] Initial phone detection: ${rawItems.length - missingCount}/${rawItems.length} have phone in feed snippet.`);

      if (missingCount > 0) {
        console.log(`[Scraper] Starting fast detail enrichment for ${missingCount} cards without phone...`);
        // Limit to max 8 cards to prevent Google Maps DOM bloat and memory leaks
        const maxToEnrich = Math.min(rawItems.length, 8);

        for (let i = 0; i < maxToEnrich; i++) {
          const item = rawItems[i];
          if (item.phone) continue; // Already has phone, skip!

          try {
            const detail = await page.evaluate(async (cardIndex, expectedName) => {
              const feed = document.querySelector('div[role="feed"]');
              if (!feed) return null;
              const cards = feed.querySelectorAll('div.Nv2PK');
              const card = cards[cardIndex];
              if (!card) return null;

              const link = card.querySelector('a.hfpxzc') || card.querySelector('a[href*="/maps/place"]');
              if (!link) return null;

              card.scrollIntoView({ block: 'nearest' });
              link.click();

              const start = Date.now();
              let phone = null;
              let website = null;
              let address = null;

              // Fast poll up to 900ms for detail panel
              while (Date.now() - start < 900) {
                const titleEl = document.querySelector('h1.DUwDvf');
                const activeTitle = titleEl ? titleEl.textContent?.trim() : '';

                const normActive = activeTitle.toLowerCase().replace(/[^\w]/g, '');
                const normExpected = (expectedName || '').toLowerCase().replace(/[^\w]/g, '');

                if (activeTitle && (normActive.includes(normExpected.slice(0, 5)) || normExpected.includes(normActive.slice(0, 5)))) {
                  // 1. Phone from button, aria-label, or tel link
                  const phoneBtn = document.querySelector('button[data-item-id*="phone"]');
                  const phoneAria = document.querySelector('button[aria-label*="Teléfono:" i]');
                  const telLink = document.querySelector('a[href^="tel:"]');

                  if (phoneBtn) {
                    const raw = phoneBtn.textContent.replace(/[^\d\s+\-()]/g, '').trim();
                    if (raw && /\d{4}/.test(raw)) phone = raw;
                  }
                  if (!phone && phoneAria) {
                    const m = phoneAria.getAttribute('aria-label').match(/(?:Teléfono:\s*)?([0-9\s+\-()]+)/i);
                    if (m) phone = m[1].trim();
                  }
                  if (!phone && telLink) {
                    phone = telLink.href.replace('tel:', '').trim();
                  }

                  // 2. Official Website
                  const webEl = document.querySelector('a[data-item-id="authority"], a[aria-label*="sitio web" i]');
                  if (webEl && webEl.href) {
                    website = webEl.href;
                  }

                  // 3. Exact Address
                  const addrBtn = document.querySelector('button[data-item-id="address"]');
                  if (addrBtn) {
                    address = addrBtn.textContent.replace(/[^\w\s\u00C0-\u00FF.,°#\-/]/gi, '').trim();
                  }

                  break;
                }

                await new Promise(r => setTimeout(r, 60));
              }

              return { phone, website, address };
            }, item.index, item.name);

            if (detail) {
              if (detail.phone) {
                item.phone = detail.phone;
                console.log(`[Scraper] Enriched phone for "${item.name}": ${detail.phone}`);
              }
              if (detail.website && !item.website) {
                item.website = detail.website;
              }
              if (detail.address) {
                item.detailAddress = detail.address;
              }
            }
          } catch (clickErr) {
            // Ignore single card click error and proceed
          }
        }
      }
    }

    // Parse and normalize into frontend-ready lead format
    const leads = rawItems.map((item, idx) => {
      const details = extractDetailsFromTextLines(item.textLines, item.cardInnerText);
      const formattedPhone = item.phone || details.phone || null;
      const intlPhone = formattedPhone ? formatArgentinePhone(formattedPhone) : null;
      const { status, classification } = classifyWebsite(item.website);

      // Extract city and province from query or address dynamically
      let city = '';
      let provincia = '';
      const addressToCheck = item.detailAddress || details.address || '';

      // 1. Try to extract from search query (e.g. "Restaurantes en Córdoba, Córdoba" or "en Rosario")
      const queryMatch = query.match(/(?:en|in)\s+([^,]+)(?:,\s*(.+))?/i);
      if (queryMatch) {
        city = queryMatch[1].trim();
        if (queryMatch[2]) provincia = queryMatch[2].trim();
      }

      // 2. Try to refine from address parts if available
      if (addressToCheck.includes(',')) {
        const parts = addressToCheck.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const candidate = parts[parts.length - 2].replace(/\b[A-Z0-9]{4,8}\b/g, '').replace(/provincia de/gi, '').trim();
          if (candidate.length > 2 && candidate.length < 35 && !/^\d+$/.test(candidate)) {
            city = candidate;
          }
          const lastPart = parts[parts.length - 1].trim();
          if (lastPart.length > 2 && lastPart.length < 35) {
            provincia = lastPart;
          }
        }
      }

      if (!city) city = 'Comercial';

      // Clean trailing status like 'Cerrado', 'Abierto', 'Abre a las...' from address
      let cleanAddress = item.detailAddress || details.address || '';
      cleanAddress = cleanAddress.replace(/(?:cerrado|abierto|abre\s+a\s+las|cierra).*$/i, '').trim();
      cleanAddress = cleanAddress.replace(/[\s,.-]+$/, '').trim();

      // Fallback clean address
      const finalAddress = cleanAddress || (city !== 'Comercial' ? `${city}${provincia ? `, ${provincia}` : ''}` : 'Dirección en Google Maps');

      return {
        id: `scraper-${Date.now()}-${idx + 1}`,
        name: item.name,
        displayName: item.name,
        rubro: details.category || 'Negocio / Comercio',
        primaryTypeDisplayName: details.category || 'Negocio / Comercio',
        formattedAddress: finalAddress,
        address: finalAddress,
        city,
        provincia: provincia || 'Nacional / Global',
        phone: formattedPhone,
        nationalPhoneNumber: formattedPhone,
        internationalPhoneNumber: intlPhone,
        website: item.website || null,
        websiteUri: item.website || null,
        rating: item.rating,
        reviews: item.reviews || 0,
        user_ratings_total: item.reviews || 0,
        userRatingCount: item.reviews || 0,
        maps_url: item.maps_url,
        googleMapsUri: item.maps_url,
        status, // "SIN WEB" | "SOLO REDES" | "CON WEB"
        classification,
        source: 'scraper_local',
        createdAt: new Date().toISOString()
      };
    });

    return leads;
  } finally {
    await page.close().catch(() => {});
    console.log(`[Scraper] Page closed cleanly (browser singleton preserved)`);
    resetBrowserIdleTimer();
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LeadRadar Google Maps Scraper',
    browserConnected: Boolean(sharedBrowser && sharedBrowser.connected),
    cacheEntries: queryCache.size,
    timestamp: new Date().toISOString()
  });
});

// Cache stats and clear
app.get('/api/cache/stats', (req, res) => {
  res.json({
    size: queryCache.size,
    keys: Array.from(queryCache.keys())
  });
});

app.delete('/api/cache', (req, res) => {
  queryCache.clear();
  res.json({ success: true, message: 'Cache limpiado correctamente' });
});

// Scraping endpoint: GET /api/scrape?query=...&refresh=...
app.get('/api/scrape', async (req, res) => {
  const { query, limit, refresh } = req.query;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'El parámetro "query" es requerido. Ejemplo: /api/scrape?query=Ferreterias+en+Berisso',
      data: []
    });
  }

  const cleanQuery = query.trim();

  // Check cache unless explicitly requested to refresh
  if (refresh !== 'true') {
    const cached = getCachedResults(cleanQuery);
    if (cached) {
      console.log(`[Scraper Cache] HIT for query: "${cleanQuery}" (${cached.length} leads)`);
      return res.json({
        success: true,
        count: cached.length,
        data: cached,
        query: cleanQuery,
        source: 'scraper_local_cache',
        fromCache: true
      });
    }
  }

  const targetLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 35, 10), 60) : 35;

  try {
    const results = await scrapeGoogleMaps(cleanQuery, targetLimit);
    
    // Store in cache
    setCachedResults(cleanQuery, results);

    res.json({
      success: true,
      count: results.length,
      data: results,
      query: cleanQuery,
      source: 'scraper_local',
      fromCache: false
    });
  } catch (error) {
    console.error('[Scraper Error]:', error);
    res.status(500).json({
      success: false,
      error: `Error durante el scraping con Puppeteer: ${error.message}`,
      data: []
    });
  }
});

// ==========================================
// CRM REST API Endpoints (Local JSON File)
// ==========================================

// GET /api/crm/leads - Retrieve all saved CRM leads
app.get('/api/crm/leads', (req, res) => {
  try {
    const leads = readCrmFile();
    res.json({
      success: true,
      count: leads.length,
      data: leads
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// POST /api/crm/leads - Save or update single lead
app.post('/api/crm/leads', (req, res) => {
  try {
    const lead = req.body;
    if (!lead || !lead.id) {
      return res.status(400).json({ success: false, error: 'Lead válido con id es requerido' });
    }

    const leads = readCrmFile();
    const existingIndex = leads.findIndex(l => l.id === lead.id);

    if (existingIndex >= 0) {
      leads[existingIndex] = {
        ...leads[existingIndex],
        ...lead,
        updatedAt: new Date().toISOString()
      };
    } else {
      leads.unshift({
        ...lead,
        crmStatus: lead.crmStatus || 'Pendiente',
        savedAt: new Date().toISOString()
      });
    }

    writeCrmFile(leads);
    res.json({ success: true, count: leads.length, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/crm/leads/bulk - Bulk import / upsert leads
app.post('/api/crm/leads/bulk', (req, res) => {
  try {
    const { leads: incoming } = req.body;
    if (!Array.isArray(incoming)) {
      return res.status(400).json({ success: false, error: 'Array "leads" requerido' });
    }

    const currentLeads = readCrmFile();
    const map = new Map(currentLeads.map(l => [l.id, l]));

    for (const lead of incoming) {
      if (lead && lead.id) {
        const prev = map.get(lead.id);
        map.set(lead.id, {
          ...(prev || {}),
          ...lead,
          crmStatus: prev?.crmStatus || lead.crmStatus || 'Pendiente',
          updatedAt: new Date().toISOString()
        });
      }
    }

    const updated = Array.from(map.values());
    writeCrmFile(updated);

    res.json({
      success: true,
      count: updated.length,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/crm/leads/:id - Remove single lead
app.delete('/api/crm/leads/:id', (req, res) => {
  try {
    const { id } = req.params;
    let leads = readCrmFile();
    const beforeCount = leads.length;
    leads = leads.filter(l => l.id !== id);
    writeCrmFile(leads);

    res.json({
      success: true,
      removed: beforeCount - leads.length,
      remaining: leads.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/crm/leads - Clear all CRM leads (Preserves permanent contacted_history)
app.delete('/api/crm/leads', (req, res) => {
  try {
    writeCrmFile([]);
    res.json({ success: true, message: 'Tablero CRM vaciado correctamente. El historial permanente de contactados se mantiene intacto.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Permanent Contacted History Endpoints
// (Guardan para siempre los negocios ya contactados para evitar mensajes duplicados)
// ==========================================

// GET /api/contacted - Get all permanently contacted businesses
app.get('/api/contacted', (req, res) => {
  try {
    const records = readContactedFile();
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/contacted - Permanently save a single contacted business
app.post('/api/contacted', (req, res) => {
  try {
    const body = req.body || {};
    const lead = body.lead || body;
    const metadata = body.metadata || {};

    if (!lead || (!lead.displayName && !lead.name && !lead.phone && !lead.id)) {
      return res.status(400).json({ success: false, error: 'Datos de prospecto requeridos' });
    }

    const records = readContactedFile();
    const rawPhone = lead.phone || lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.cleanPhone || '';
    const cleanPhone = cleanPhoneDigitsServer(rawPhone) || lead.cleanPhone || '';
    const leadId = lead.id || lead.placeId;

    const existingIndex = records.findIndex(r => {
      if (leadId && (r.id === leadId || r.placeId === leadId)) return true;
      if (cleanPhone && r.cleanPhone && r.cleanPhone === cleanPhone) return true;
      return false;
    });

    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const newRecord = {
      id: leadId || (existingIndex >= 0 ? records[existingIndex].id : `lead_${Date.now()}`),
      placeId: lead.placeId || leadId || (existingIndex >= 0 ? records[existingIndex].placeId : ''),
      displayName: lead.displayName || lead.name || (existingIndex >= 0 ? records[existingIndex].displayName : 'Comercio'),
      phone: rawPhone || (existingIndex >= 0 ? records[existingIndex].phone : ''),
      cleanPhone: cleanPhone || (existingIndex >= 0 ? records[existingIndex].cleanPhone : ''),
      rubro: lead.rubro || (existingIndex >= 0 ? records[existingIndex].rubro : 'Comercio'),
      city: lead.city || (existingIndex >= 0 ? records[existingIndex].city : ''),
      address: lead.formattedAddress || lead.address || (existingIndex >= 0 ? records[existingIndex].address : ''),
      mapsUrl: lead.googleMapsUri || lead.maps_url || (existingIndex >= 0 ? records[existingIndex].mapsUrl : ''),
      firstContactedAt: existingIndex >= 0 ? records[existingIndex].firstContactedAt : now.toISOString(),
      lastContactedAt: now.toISOString(),
      formattedDate: existingIndex >= 0 ? records[existingIndex].formattedDate || formattedDate : formattedDate,
      contactMethod: metadata.contactMethod || lead.contactMethod || (existingIndex >= 0 ? records[existingIndex].contactMethod : 'manual_whatsapp'),
      pitchSent: metadata.messageSnippet || lead.pitchSent || lead.lastPitchSent || lead.pregeneratedPitch || lead.customPitch || (existingIndex >= 0 ? records[existingIndex].pitchSent : ''),
      contactCount: existingIndex >= 0 ? (records[existingIndex].contactCount || 1) + 1 : 1
    };

    if (existingIndex >= 0) {
      records[existingIndex] = newRecord;
    } else {
      records.unshift(newRecord);
    }

    writeContactedFile(records);
    res.json({ success: true, message: 'Guardado permanentemente', data: newRecord });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/contacted/bulk - Bulk save contacted businesses
app.post('/api/contacted/bulk', (req, res) => {
  try {
    const rawList = req.body?.leads || req.body;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return res.status(400).json({ success: false, error: 'Lista de prospectos requerida' });
    }

    const records = readContactedFile();
    const existingSet = new Set();
    for (const r of records) {
      if (r.id) existingSet.add(r.id);
      if (r.placeId) existingSet.add(r.placeId);
      if (r.cleanPhone) existingSet.add(r.cleanPhone);
    }

    let addedCount = 0;
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    for (const item of rawList) {
      const lead = item?.lead || item || {};
      const metadata = item?.metadata || {};
      const rawPhone = lead.phone || lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.cleanPhone || '';
      const cleanPhone = cleanPhoneDigitsServer(rawPhone) || lead.cleanPhone || '';
      const leadId = lead.id || lead.placeId;

      const isKnown = (leadId && existingSet.has(leadId)) || (cleanPhone && existingSet.has(cleanPhone));
      if (!isKnown) {
        const record = {
          id: leadId || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          placeId: lead.placeId || leadId || '',
          displayName: lead.displayName || lead.name || 'Comercio',
          phone: rawPhone,
          cleanPhone,
          rubro: lead.rubro || 'Comercio',
          city: lead.city || '',
          address: lead.formattedAddress || lead.address || '',
          mapsUrl: lead.googleMapsUri || lead.maps_url || '',
          firstContactedAt: now.toISOString(),
          lastContactedAt: now.toISOString(),
          formattedDate,
          contactMethod: metadata.contactMethod || lead.contactMethod || 'bot_whatsapp',
          pitchSent: metadata.messageSnippet || lead.pitchSent || lead.lastPitchSent || lead.pregeneratedPitch || '',
          contactCount: 1
        };
        records.unshift(record);
        if (leadId) existingSet.add(leadId);
        if (cleanPhone) existingSet.add(cleanPhone);
        addedCount++;
      }
    }

    writeContactedFile(records);
    res.json({ success: true, added: addedCount, total: records.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Automated WhatsApp Puppeteer Bot Endpoints
// ==========================================

// GET /api/whatsapp/status - Check WhatsApp session & campaign state
app.get('/api/whatsapp/status', (req, res) => {
  try {
    const status = getWhatsAppStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/connect - Launch WhatsApp Puppeteer and request QR/session
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const status = await connectWhatsApp();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/disconnect - Close session and logout
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    const result = await disconnectWhatsApp();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/campaign/start - Start automated dispatch campaign
app.post('/api/whatsapp/campaign/start', async (req, res) => {
  try {
    const { leads, delaySeconds } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, error: 'Se requiere una lista de prospectos válida' });
    }

    const status = await startCampaign(leads, {
      delaySeconds: delaySeconds || 12,
      updateLeadCallback: (leadId, updates) => {
        try {
          const currentLeads = readCrmFile();
          const idx = currentLeads.findIndex(l => l.id === leadId);
          if (idx >= 0) {
            currentLeads[idx] = { ...currentLeads[idx], ...updates, updatedAt: new Date().toISOString() };
            writeCrmFile(currentLeads);
          }
        } catch (crmErr) {
          console.error('[CRM Update Error during campaign]:', crmErr);
        }
      }
    });

    res.json({ success: true, data: status });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/whatsapp/campaign/stop - Stop ongoing dispatch
app.post('/api/whatsapp/campaign/stop', (req, res) => {
  try {
    const result = stopCampaign();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Mini Website Auditor Endpoint
// ==========================================
// GET /api/audit-web?url=https://example.com
app.get('/api/audit-web', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return res.status(400).json({ success: false, error: 'URL requerida' });
  }

  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 LeadRadar/2.5'
      },
      redirect: 'follow'
    });
    clearTimeout(timeoutId);

    const responseTimeMs = Date.now() - startTime;
    const finalUrl = response.url || targetUrl;
    const isHttps = finalUrl.startsWith('https://');
    const status = response.status;

    // Read initial HTML text (up to 70KB)
    const htmlText = await response.text().catch(() => '');
    const lowerHtml = htmlText.slice(0, 75000).toLowerCase();

    const hasViewport = lowerHtml.includes('name="viewport"') || lowerHtml.includes("name='viewport'");
    const titleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Sin título';

    // Issues detection
    const issues = [];
    if (!isHttps) issues.push('Sin certificado SSL seguro (HTTP inseguro)');
    if (!hasViewport) issues.push('No está adaptada para celulares (Falta tag Viewport)');
    if (responseTimeMs > 2400) issues.push(`Carga muy lenta (${(responseTimeMs / 1000).toFixed(1)}s)`);
    if (status >= 400) issues.push(`Código de error HTTP: ${status}`);

    // Detect platform / CMS
    let platform = 'Desarrollo Propio';
    if (lowerHtml.includes('wp-content') || lowerHtml.includes('wordpress')) platform = 'WordPress';
    else if (lowerHtml.includes('wix.com')) platform = 'Wix';
    else if (lowerHtml.includes('shopify')) platform = 'Shopify';
    else if (lowerHtml.includes('tiendanube')) platform = 'Tiendanube';
    else if (lowerHtml.includes('squarespace')) platform = 'Squarespace';

    let opportunityLevel = 'Baja';
    let opportunitySummary = 'Web moderna en buen estado aparente';

    if (issues.length >= 2 || !isHttps || !hasViewport) {
      opportunityLevel = 'Alta';
      opportunitySummary = 'Oportunidad excelente: Web desactualizada o con fallas críticas para rediseño';
    } else if (issues.length === 1 || responseTimeMs > 1800) {
      opportunityLevel = 'Media';
      opportunitySummary = 'Oportunidad de optimización y rediseño responsive';
    }

    res.json({
      success: true,
      url: targetUrl,
      finalUrl,
      status,
      responseTimeMs,
      isHttps,
      hasViewport,
      title,
      platform,
      issues,
      opportunityLevel,
      opportunitySummary
    });
  } catch (err) {
    res.json({
      success: true,
      url: targetUrl,
      finalUrl: targetUrl,
      status: 0,
      responseTimeMs: Date.now() - startTime,
      isHttps: false,
      hasViewport: false,
      title: 'Sitio inaccesible',
      platform: 'Desconocido',
      issues: ['Sitio web inaccesible, caído o bloqueando conexiones'],
      opportunityLevel: 'Muy Alta',
      opportunitySummary: 'Web rota o caída: Oportunidad de oro para ofrecer desarrollo web nuevo'
    });
  }
});

// Serve production frontend assets if built
const DIST_DIR = path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
    next();
  });
}


// Start Express server
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Servidor LeadRadar Backend corriendo en puerto ${PORT}`);
  console.log(`📍 Scraper: http://localhost:${PORT}/api/scrape?query=...`);
  console.log(`💾 CRM API: http://localhost:${PORT}/api/crm/leads`);
  console.log(`🔍 Auditor: http://localhost:${PORT}/api/audit-web?url=...`);
  console.log(`🩺 Health:  http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

// Graceful process cleanup
const handleShutdown = async () => {
  console.log('[LeadRadar Server] Shutting down cleanly...');
  if (sharedBrowser && sharedBrowser.connected) {
    await sharedBrowser.close().catch(() => {});
    console.log('[LeadRadar Server] Puppeteer browser closed.');
  }
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

export default app;
