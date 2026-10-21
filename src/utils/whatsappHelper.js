/**
 * Utility functions to clean, format and generate WhatsApp URLs for Argentine and international phone numbers
 * Includes Multi-Template management and Phone-Type Detection (Mobile vs Landline).
 */

/**
 * 4 Curated B2B Sales Outreach Templates for Web Agencies & Freelancers
 */
export const WHATSAPP_TEMPLATES = {
  no_web: {
    id: 'no_web',
    title: 'Sin Sitio Web',
    subtitle: 'Captación para negocios sin presencia web',
    badge: 'Sin Web',
    text: `Hola {nombre}. Vi su ficha en Google Maps de {ciudad} y noté que aún no cuentan con un sitio web oficial propio.

Me dedico a desarrollar páginas web modernas, rápidas y adaptadas a celulares para negocios de {rubro}, pensadas para que cada vecino que busque en Google pueda contactarlos directo.

¿Te interesaría que conversemos brevemente sobre cómo implementarlo para {nombre} y recibir más consultas directas por WhatsApp? Un saludo cordial.`
  },
  social_only: {
    id: 'social_only',
    title: 'Solo Redes / Instagram',
    subtitle: 'Conversión para negocios que usan solo Instagram o Facebook',
    badge: 'Solo Redes',
    text: `Hola {nombre}. Vi su perfil en redes y su ficha en Google Maps en {ciudad}. Felicitaciones por el trabajo en {rubro}.

Quería comentarte que depender únicamente de las redes limita las ventas cuando los clientes buscan directamente en Google para resolver una necesidad en el momento.

Desarrollamos sitios web y catálogos ágiles conectados directo a WhatsApp para no perder esas ventas y transmitir máxima seriedad. ¿Estarían interesados en sumar una página web oficial para captar más clientes desde Google?`
  },
  redesign: {
    id: 'redesign',
    title: 'Rediseño Web',
    subtitle: 'Propuesta de modernización para webs obsoletas o lentas',
    badge: 'Rediseño',
    text: `Hola {nombre}. Estuve visitando su sitio web de {rubro} en {ciudad}.

Noté algunas oportunidades de mejora en velocidad y adaptación a pantallas de celulares que hoy en día hacen que se pierdan visitas y clientes potenciales en Google.

Nos especializamos en renovar sitios web haciéndolos ultra rápidos, responsivos y con botón directo de WhatsApp. ¿Te gustaría conocer algunos puntos clave de mejora para su sitio?`
  },
  follow_up: {
    id: 'follow_up',
    title: 'Seguimiento / Re-contacto',
    subtitle: 'Para prospectos en charla o seguimiento en el CRM',
    badge: 'Seguimiento',
    text: `Hola {nombre}. Te escribo nuevamente para consultar si pudieron revisar la propuesta que les compartí para el sitio web de {rubro} en {ciudad}.

Cualquier duda o ajuste que quieran conversar, estoy a total disposición para coordinar una llamada breve cuando les quede cómodo. Que tengan una excelente semana.`
  }
};

export const DEFAULT_WHATSAPP_TEMPLATE = WHATSAPP_TEMPLATES.no_web.text;

/**
 * Clean and normalize a phone number into international WhatsApp format
 * Supports both Argentine numbers (auto-adding 549, stripping 0/15) and foreign numbers (+34, +1, +52, +56, etc.)
 * @param {string} rawPhone - Raw phone string
 * @returns {string|null} - Cleaned digits suitable for wa.me, or null if invalid
 */
export function formatPhoneForWhatsApp(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const trimmed = rawPhone.trim();

  // If explicitly prefixed with + (international number)
  if (trimmed.startsWith('+')) {
    const intlDigits = trimmed.replace(/\D/g, '');
    if (intlDigits.startsWith('54')) {
      return formatArgentinePhoneForWhatsApp(trimmed);
    }
    if (intlDigits.length >= 8) {
      return intlDigits;
    }
  }

  return formatArgentinePhoneForWhatsApp(trimmed);
}

/**
 * Clean and normalize an Argentine phone number into international WhatsApp format (549...)
 * @param {string} rawPhone
 * @returns {string|null}
 */
export function formatArgentinePhoneForWhatsApp(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return null;

  // Extract only digits
  let digits = rawPhone.replace(/\D/g, '');

  if (!digits || digits.length < 6) return null;

  // Case 1: Already starts with 549 (International Argentine Mobile)
  if (digits.startsWith('549')) {
    let rest = digits.slice(3);
    if (rest.length === 12) {
      rest = rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    }
    return '549' + rest;
  }

  // Case 2: Starts with 54 (Argentina international without mobile 9)
  if (digits.startsWith('54')) {
    let without54 = digits.slice(2);
    if (without54.startsWith('0')) {
      without54 = without54.slice(1);
    }
    if (without54.length === 12) {
      without54 = without54.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    }
    return '549' + without54;
  }

  // Case 3: Starts with leading 0 (national trunk, e.g. 0221 461..., 011...)
  if (digits.startsWith('0')) {
    let rest = digits.slice(1);
    if (rest.length === 12) {
      rest = rest.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
    }
    return '549' + rest;
  }

  // Case 4: If it's a 7-digit local number without area code
  if (digits.length === 7) {
    return '549221' + digits;
  }

  // Case 5: 12 digits with 15
  if (digits.length === 12) {
    digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');
  }

  // Standard 10 digits (area code + number)
  return '549' + digits;
}

/**
 * Format phone for visual user interface
 * @param {string} phone
 * @returns {string}
 */
export function formatDisplayPhone(phone) {
  if (!phone) return 'Sin teléfono';
  return phone.trim();
}

/**
 * Detect whether phone number is likely a mobile phone (WhatsApp-ready)
 * or a traditional landline (which usually cannot receive WhatsApp chats)
 * @param {string} phone
 * @returns {{ isMobile: boolean, label: string, warning: string | null }}
 */
export function getPhoneType(phone) {
  if (!phone || typeof phone !== 'string') {
    return { isMobile: false, label: 'Sin número', warning: null };
  }

  const clean = phone.trim();
  const digits = clean.replace(/\D/g, '');

  if (!digits || digits.length < 6) {
    return { isMobile: false, label: 'Sin número', warning: null };
  }

  // 1. Explicit cell identifier in text (e.g. "15-xxxx-xxxx", "cel:", "móvil:")
  if (/15[\s.-]?\d{3,4}[\s.-]?\d{3,4}/.test(clean) || /cel|móvil|movil|whatsapp/i.test(clean)) {
    return { isMobile: true, label: 'Celular WhatsApp', warning: null };
  }

  // 2. Starts with international non-Argentine code
  if (clean.startsWith('+') && !clean.startsWith('+54')) {
    return { isMobile: true, label: 'Línea Internacional', warning: null };
  }

  // Normalize Argentine national digits (strip 549, 54, and leading 0)
  let localDigits = digits;
  if (localDigits.startsWith('549')) {
    localDigits = localDigits.slice(3);
  } else if (localDigits.startsWith('54')) {
    localDigits = localDigits.slice(2);
  }
  if (localDigits.startsWith('0')) {
    localDigits = localDigits.slice(1);
  }

  // 3. Argentine landline indicators: Area code followed immediately by 4 or 5 without 15
  // Common prefixes: 0221 4..., 011 4..., 011 5..., 0341 4..., 0800, 0810
  const isLikelyLandline = /^(?:221|11|223|341|351|261|381|291|264|387|379|342|385|383|299|280|2966)[45]\d{5,7}$/.test(localDigits) ||
                           /^(?:800|810)\d{6,8}$/.test(localDigits) ||
                           /^[45]\d{5,6}$/.test(localDigits); // Local 6-7 digit landline without area code

  if (isLikelyLandline) {
    return {
      isMobile: false,
      label: 'Posible Tel. Fijo',
      warning: 'Atención: Parece una línea fija comercial tradicional (podría no tener WhatsApp).'
    };
  }

  // 4. Default assumption for 10-13 digits (mobile / whatsapp)
  if (digits.length >= 10 || localDigits.length >= 8) {
    return { isMobile: true, label: 'Móvil / WhatsApp', warning: null };
  }

  return { isMobile: false, label: 'Teléfono Fijo', warning: null };
}

/**
 * Automatically recommend best WhatsApp outreach template based on lead status
 * @param {object} lead
 * @returns {string} - Template ID key ('no_web' | 'social_only' | 'redesign' | 'follow_up')
 */
export function getRecommendedTemplateId(lead) {
  if (!lead) return 'no_web';
  if (lead.status === 'Contactado' || lead.status === 'En charla' || lead.crmStatus === 'Contactado' || lead.crmStatus === 'En charla') {
    return 'follow_up';
  }
  if (lead.classification?.type === 'SOCIAL_ONLY') {
    return 'social_only';
  }
  if (lead.classification?.type === 'HAS_WEB') {
    return 'redesign';
  }
  return 'no_web';
}

/**
 * Replace dynamic placeholders in the message template
 * @param {string} template - The text template containing {nombre}, {rubro}, {ciudad}
 * @param {object} lead - Lead object with displayName, rubro, city, etc.
 * @returns {string} - The personalized message
 */
export function personalizeMessage(template, lead) {
  if (!template) return '';
  const businessName = lead?.displayName || lead?.name || 'su negocio';
  const businessRubro = lead?.rubro || lead?.primaryType || lead?.primaryTypeDisplayName || 'su rubro';
  const businessCity = lead?.city || lead?.zona || 'la zona';

  return template
    .replace(/\{nombre\}/gi, businessName)
    .replace(/\{rubro\}/gi, businessRubro)
    .replace(/\{ciudad\}/gi, businessCity);
}

/**
 * Build a ready-to-click WhatsApp Web / mobile URL
 * @param {string} rawPhone - Raw phone number
 * @param {string} template - WhatsApp text template
 * @param {object} lead - Lead object
 * @param {string|null} overrideMessage - Optional direct custom or AI-generated message string
 * @returns {string|null} - https://wa.me/... link or null if phone is invalid
 */
export function generateWhatsAppLink(rawPhone, template, lead, overrideMessage = null) {
  const cleanPhone = formatPhoneForWhatsApp(rawPhone);
  if (!cleanPhone) return null;

  const message = overrideMessage || personalizeMessage(template || DEFAULT_WHATSAPP_TEMPLATE, lead);
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
