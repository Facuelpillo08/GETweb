import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WA_SESSION_DIR = path.join(__dirname, 'data', 'whatsapp_session');

if (!fs.existsSync(WA_SESSION_DIR)) {
  fs.mkdirSync(WA_SESSION_DIR, { recursive: true });
}

let waBrowser = null;
let waPage = null;
let waStatus = 'disconnected'; // 'disconnected' | 'starting' | 'qr_ready' | 'authenticating' | 'ready' | 'sending' | 'error'
let waQrData = null;
let waLastError = null;
let authCheckInterval = null;

let campaignState = {
  running: false,
  total: 0,
  sent: 0,
  failed: 0,
  currentLead: null,
  countdown: 0,
  logs: [],
  shouldStop: false
};

/**
 * Format phone to international digits suitable for web.whatsapp.com/send?phone=...
 */
function cleanPhoneDigits(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits || digits.length < 6) return null;

  // Argentina normalization
  if (digits.startsWith('549')) {
    let rest = digits.slice(3);
    if (rest.length === 12) rest = rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    return '549' + rest;
  }
  if (digits.startsWith('54')) {
    let rest = digits.slice(2);
    if (rest.startsWith('0')) rest = rest.slice(1);
    if (rest.length === 12) rest = rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    return '549' + rest;
  }
  if (digits.startsWith('0')) {
    let rest = digits.slice(1);
    if (rest.length === 12) rest = rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    return '549' + rest;
  }
  if (digits.length === 7) {
    return '549221' + digits;
  }
  if (digits.length === 12 && digits.includes('15')) {
    digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  }

  // If already has foreign country code (+34, +1, +52, +56, etc)
  if (digits.length >= 10 && !digits.startsWith('549')) {
    return '549' + digits;
  }

  return digits;
}

/**
 * Remove all emojis from text
 */
function stripEmojis(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{FE0F}\u{200D}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Get current WhatsApp status
 */
export function getWhatsAppStatus() {
  return {
    status: waStatus,
    qr: waQrData,
    error: waLastError,
    sessionExists: fs.existsSync(WA_SESSION_DIR) && fs.readdirSync(WA_SESSION_DIR).length > 0,
    campaign: {
      running: campaignState.running,
      total: campaignState.total,
      sent: campaignState.sent,
      failed: campaignState.failed,
      currentLead: campaignState.currentLead,
      countdown: campaignState.countdown,
      logs: campaignState.logs.slice(-25)
    }
  };
}

/**
 * Start or connect to WhatsApp Web session via Puppeteer
 */
export async function connectWhatsApp() {
  if (waStatus === 'ready' && waBrowser && waPage) {
    return getWhatsAppStatus();
  }

  waStatus = 'starting';
  waQrData = null;
  waLastError = null;

  try {
    if (!waBrowser || !waBrowser.connected) {
      console.log('[WhatsApp Bot] Launching Puppeteer with persistent session:', WA_SESSION_DIR);
      const customChromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
      waBrowser = await puppeteer.launch({
        headless: 'new',
        userDataDir: WA_SESSION_DIR,
        ...(customChromiumPath ? { executablePath: customChromiumPath } : {}),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ]
      });

      const pages = await waBrowser.pages();
      waPage = pages.length > 0 ? pages[0] : await waBrowser.newPage();
      await waPage.setViewport({ width: 1280, height: 800 });
    }

    console.log('[WhatsApp Bot] Navigating to WhatsApp Web...');
    await waPage.goto('https://web.whatsapp.com', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Check if already authenticated or if QR canvas is present
    let attempts = 0;
    if (authCheckInterval) clearInterval(authCheckInterval);

    authCheckInterval = setInterval(async () => {
      attempts++;
      if (!waPage || waPage.isClosed()) {
        clearInterval(authCheckInterval);
        waStatus = 'disconnected';
        return;
      }

      try {
        // 1. Check if logged in (chat list or search input visible)
        const isLoggedIn = await waPage.evaluate(() => {
          return Boolean(
            document.querySelector('#pane-side') ||
            document.querySelector('div[data-testid="chat-list"]') ||
            document.querySelector('div[contenteditable="true"][data-tab="3"]')
          );
        });

        if (isLoggedIn) {
          console.log('[WhatsApp Bot] Authentication confirmed! WhatsApp Web is READY.');
          waStatus = 'ready';
          waQrData = null;
          clearInterval(authCheckInterval);
          return;
        }

        // 2. Check for QR Canvas
        const qrBase64 = await waPage.evaluate(() => {
          const canvas = document.querySelector('canvas[aria-label*="Scan" i], canvas');
          if (canvas) {
            return canvas.toDataURL('image/png');
          }
          return null;
        });

        if (qrBase64) {
          waQrData = qrBase64;
          waStatus = 'qr_ready';
        }

        // Timeout after 3 minutes if neither happens
        if (attempts > 90) {
          clearInterval(authCheckInterval);
          if (waStatus !== 'ready') {
            waStatus = 'disconnected';
            waLastError = 'Tiempo de espera de autenticación agotado. Volvé a intentar.';
          }
        }
      } catch (checkErr) {
        // Page might be navigating or rendering
      }
    }, 1500);

    return getWhatsAppStatus();
  } catch (err) {
    console.error('[WhatsApp Bot] Error initializing session:', err);
    waStatus = 'error';
    waLastError = err.message;
    return getWhatsAppStatus();
  }
}

/**
 * Disconnect WhatsApp Web and clear session
 */
export async function disconnectWhatsApp() {
  if (authCheckInterval) clearInterval(authCheckInterval);
  campaignState.shouldStop = true;
  campaignState.running = false;

  try {
    if (waBrowser) {
      await waBrowser.close().catch(() => {});
      waBrowser = null;
      waPage = null;
    }
  } catch (_) {}

  waStatus = 'disconnected';
  waQrData = null;
  waLastError = null;

  return { success: true, message: 'WhatsApp desconectado correctamente.' };
}

/**
 * Stop currently running dispatch campaign
 */
export function stopCampaign() {
  if (campaignState.running) {
    campaignState.shouldStop = true;
    campaignState.logs.push(`[${new Date().toLocaleTimeString()}] Campaña cancelada por el usuario.`);
  }
  return { success: true, message: 'Campaña detenida.' };
}

/**
 * Send a single WhatsApp message via Puppeteer session
 */
async function sendSingleMessage(phone, messageText) {
  if (!waPage || waPage.isClosed()) {
    throw new Error('Página de WhatsApp Web no disponible');
  }

  const cleanDigits = cleanPhoneDigits(phone);
  if (!cleanDigits) {
    throw new Error('Número de teléfono inválido');
  }

  const cleanText = stripEmojis(messageText);
  const waUrl = `https://web.whatsapp.com/send?phone=${cleanDigits}&text=${encodeURIComponent(cleanText)}`;

  console.log(`[WhatsApp Bot] Navigating to chat: ${cleanDigits}...`);
  await waPage.goto(waUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Wait for either the send button, the message box, or an invalid number alert
  const result = await Promise.race([
    // Check for send button or active editable message box
    waPage.waitForSelector('span[data-icon="send"], button[aria-label="Send"], button[aria-label="Enviar"], [data-testid="send"]', { timeout: 35000 })
      .then(() => 'SEND_BUTTON_READY'),

    // Check for contenteditable message composer box
    waPage.waitForSelector('div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]', { timeout: 35000 })
      .then(() => 'COMPOSER_READY'),

    // Check for invalid phone number dialog
    waPage.waitForSelector('div[data-animate-modal-body="true"], div[role="dialog"]', { timeout: 35000 })
      .then(async () => {
        const text = await waPage.evaluate(() => document.body.innerText || '');
        if (text.includes('no es válido') || text.includes('invalid') || text.includes('no existe')) {
          return 'INVALID_NUMBER';
        }
        return 'UNKNOWN_MODAL';
      })
  ]);

  if (result === 'INVALID_NUMBER') {
    throw new Error(`El número ${cleanDigits} no está registrado en WhatsApp o es inválido.`);
  }

  // Click the send button or hit Enter in the composer
  console.log('[WhatsApp Bot] Triggering message dispatch...');
  const sendBtn = await waPage.$('span[data-icon="send"], button[aria-label="Send"], button[aria-label="Enviar"], [data-testid="send"]');
  if (sendBtn) {
    await sendBtn.click();
  } else {
    const composer = await waPage.$('div[contenteditable="true"][data-tab="10"], footer div[contenteditable="true"]');
    if (composer) {
      await composer.focus();
      await waPage.keyboard.press('Enter');
    } else {
      throw new Error('No se encontró el botón de envío ni el cuadro de texto');
    }
  }

  // Allow message to be sent over network
  await new Promise(r => setTimeout(r, 3200));

  return { success: true, phone: cleanDigits };
}

const CONTACTED_FILE = path.join(__dirname, 'data', 'contacted_history.json');

function readContactedHistory() {
  try {
    if (!fs.existsSync(CONTACTED_FILE)) return [];
    return JSON.parse(fs.readFileSync(CONTACTED_FILE, 'utf-8'));
  } catch (_) {
    return [];
  }
}

function recordContactedBusiness(lead, pitchSent) {
  try {
    const records = readContactedHistory();
    const rawPhone = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone || '';
    const cleanDigits = cleanPhoneDigits(rawPhone);
    const leadId = lead.id || lead.placeId;
    const now = new Date();

    const existingIdx = records.findIndex(r => {
      if (leadId && (r.id === leadId || r.placeId === leadId)) return true;
      if (cleanDigits && r.cleanPhone && r.cleanPhone === cleanDigits) return true;
      return false;
    });

    const recordData = {
      id: leadId || `lead_${Date.now()}`,
      placeId: lead.placeId || leadId || '',
      displayName: lead.displayName || lead.name || 'Comercio',
      phone: rawPhone,
      cleanPhone: cleanDigits,
      rubro: lead.rubro || 'Comercio',
      city: lead.city || '',
      address: lead.formattedAddress || lead.address || '',
      mapsUrl: lead.googleMapsUri || lead.maps_url || '',
      firstContactedAt: existingIdx >= 0 ? records[existingIdx].firstContactedAt : now.toISOString(),
      lastContactedAt: now.toISOString(),
      formattedDate: now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      contactMethod: 'bot_whatsapp',
      pitchSent: pitchSent || '',
      contactCount: existingIdx >= 0 ? (records[existingIdx].contactCount || 1) + 1 : 1
    };

    if (existingIdx >= 0) {
      records[existingIdx] = recordData;
    } else {
      records.unshift(recordData);
    }

    fs.writeFileSync(CONTACTED_FILE, JSON.stringify(records, null, 2), 'utf-8');
    return recordData;
  } catch (err) {
    console.error('[WhatsApp Bot] Error saving to permanent contacted_history.json:', err);
    return null;
  }
}

/**
 * Start Automated Dispatch Campaign for Qualified Leads (NO_WEB or SOCIAL_ONLY)
 * Runs sequentially with human-safe delays to avoid WhatsApp rate limits or bans.
 * Strictly excludes any business that has already been contacted to avoid duplicates.
 *
 * @param {Array<object>} leads - Array of leads with phone and pitch
 * @param {object} options - { delaySeconds: number, updateLeadCallback: function }
 */
export async function startCampaign(leads = [], options = {}) {
  const { delaySeconds = 12, updateLeadCallback = null } = options;

  if (waStatus !== 'ready') {
    throw new Error('WhatsApp no está listo. Primero conectá tu cuenta escaneando el código QR.');
  }

  if (campaignState.running) {
    throw new Error('Ya hay una campaña de envío automático en ejecución.');
  }

  // 1. Filter ONLY leads without web or with only social media and valid phone
  const qualifiedLeads = leads.filter(lead => {
    const type = lead?.classification?.type;
    const isTarget = type === 'NO_WEB' || type === 'SOCIAL_ONLY';
    const phone = lead?.nationalPhoneNumber || lead?.internationalPhoneNumber || lead?.phone;
    return isTarget && Boolean(phone);
  });

  if (qualifiedLeads.length === 0) {
    throw new Error('No hay comercios calificados (Sin Web o Solo Redes con teléfono) para enviar.');
  }

  // 2. ANTI-DUPLICATION: Check permanent contacted_history.json to EXCLUDE any previously contacted business
  const contactedHistory = readContactedHistory();
  const contactedPhoneSet = new Set();
  const contactedIdSet = new Set();
  for (const c of contactedHistory) {
    if (c.id) contactedIdSet.add(c.id);
    if (c.placeId) contactedIdSet.add(c.placeId);
    if (c.cleanPhone) contactedPhoneSet.add(c.cleanPhone);
  }

  const uncontactedLeads = qualifiedLeads.filter(lead => {
    const phone = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone;
    const clean = cleanPhoneDigits(phone);
    const leadId = lead.id || lead.placeId;

    if (leadId && contactedIdSet.has(leadId)) return false;
    if (clean && contactedPhoneSet.has(clean)) return false;
    return true;
  });

  const alreadyContactedCount = qualifiedLeads.length - uncontactedLeads.length;

  if (uncontactedLeads.length === 0) {
    throw new Error(`Los ${qualifiedLeads.length} comercios calificados ya fueron contactados anteriormente. Se omitieron todos para evitar enviar un segundo mensaje.`);
  }

  campaignState = {
    running: true,
    total: uncontactedLeads.length,
    sent: 0,
    failed: 0,
    currentLead: null,
    countdown: 0,
    logs: [
      `[${new Date().toLocaleTimeString()}] Iniciando campaña automática para ${uncontactedLeads.length} comercios nuevos...`,
      alreadyContactedCount > 0
        ? `[${new Date().toLocaleTimeString()}] 🛡️ Protección anti-duplicados: Se omitieron ${alreadyContactedCount} comercios ya contactados anteriormente.`
        : null
    ].filter(Boolean),
    shouldStop: false
  };

  waStatus = 'sending';

  // Run in background asynchronously so HTTP request returns immediately
  (async () => {
    for (let i = 0; i < uncontactedLeads.length; i++) {
      if (campaignState.shouldStop) {
        console.log('[WhatsApp Bot] Campaign stopped by user.');
        break;
      }

      const lead = uncontactedLeads[i];
      const phone = lead.nationalPhoneNumber || lead.internationalPhoneNumber || lead.phone;
      const pitch = lead.pregeneratedPitch || lead.customPitch || lead.pitchText || '';

      campaignState.currentLead = {
        name: lead.displayName || lead.name,
        rubro: lead.rubro || 'Comercio',
        city: lead.city || '',
        phone,
        index: i + 1,
        total: uncontactedLeads.length
      };

      console.log(`[WhatsApp Bot] (${i + 1}/${uncontactedLeads.length}) Sending to ${lead.displayName}...`);
      campaignState.logs.push(`[${new Date().toLocaleTimeString()}] (${i + 1}/${uncontactedLeads.length}) Enviando a "${lead.displayName}"...`);

      try {
        await sendSingleMessage(phone, pitch);
        campaignState.sent++;
        campaignState.logs.push(`[${new Date().toLocaleTimeString()}] ✔️ Mensaje enviado con éxito a "${lead.displayName}".`);

        // Record permanently in contacted_history.json (persisted forever on disk)
        recordContactedBusiness(lead, pitch);

        // Update lead in CRM as Contactado
        if (typeof updateLeadCallback === 'function') {
          updateLeadCallback(lead.id, {
            status: 'Contactado',
            contactedAt: new Date().toISOString(),
            lastPitchSent: pitch
          });
        }
      } catch (sendErr) {
        console.error(`[WhatsApp Bot] Error sending to ${lead.displayName}:`, sendErr.message);
        campaignState.failed++;
        campaignState.logs.push(`[${new Date().toLocaleTimeString()}] ❌ Falló envío a "${lead.displayName}": ${sendErr.message}`);
      }

      // Safe delay countdown before sending next message (anti-ban protection)
      if (i < uncontactedLeads.length - 1 && !campaignState.shouldStop) {
        const pauseSecs = Math.max(parseInt(delaySeconds, 10) || 12, 6);
        for (let cd = pauseSecs; cd > 0; cd--) {
          if (campaignState.shouldStop) break;
          campaignState.countdown = cd;
          await new Promise(r => setTimeout(r, 1000));
        }
        campaignState.countdown = 0;
      }
    }

    campaignState.running = false;
    campaignState.currentLead = null;
    campaignState.logs.push(
      `[${new Date().toLocaleTimeString()}] Campaña finalizada. Enviados: ${campaignState.sent} | Fallidos: ${campaignState.failed}`
    );
    waStatus = 'ready';
  })();

  return getWhatsAppStatus();
}
