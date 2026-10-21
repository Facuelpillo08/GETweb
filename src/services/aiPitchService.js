/**
 * AI Pitch Generation Service for GETweb
 * Provides:
 * 1. Built-in Smart Algorithmic Copywriting Engine (100% Free, Private, Instant, zero API key)
 * 2. External LLM Integration with Google Gemini API & OpenAI API
 * Generates natural, high-converting, personalized WhatsApp pitches in Spanish tailored to each business.
 */

// Tone configurations with human descriptions
export const AI_TONES = [
  { id: 'friendly', name: 'Cercano & Amigable', emoji: '🤝', desc: 'Cálido, empático y felicita su reputación' },
  { id: 'direct', name: 'Directo & Comercial', emoji: '⚡', desc: 'Enfocado en captar clientes y rentabilidad' },
  { id: 'consultant', name: 'Auditor & Oportunidad', emoji: '🔍', desc: 'Muestra datos concretos y mejoras técnicas' },
  { id: 'premium', name: 'Agencia de Autoridad', emoji: '🏆', desc: 'Especialista en su rubro con propuesta y portfolio' }
];

/**
 * Clean a business display name for natural outreach conversation
 * E.g. "Ferretería El Tornillo S.A. Sucursal 2" -> "Ferretería El Tornillo"
 */
export function cleanBusinessName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'su negocio';

  let cleaned = rawName.trim();

  // Remove legal company suffixes
  cleaned = cleaned.replace(/\s+(?:S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?S\.?|C\.?A\.?|Inc\.?|Ltd\.?)\b/gi, '');
  // Remove branches like "Sucursal 1", "Suc. Centro", "Filial"
  cleaned = cleaned.replace(/\s+-\s+Sucursal.*$/gi, '');
  cleaned = cleaned.replace(/\s+Sucursal\s+\w+.*$/gi, '');
  cleaned = cleaned.replace(/\s+Suc\.\s+\w+.*$/gi, '');
  // Remove trailing dashes or city duplicates like " - La Plata"
  cleaned = cleaned.replace(/\s+-\s+.*$/g, '');
  // Remove quotation marks
  cleaned = cleaned.replace(/["'«»]/g, '');

  return cleaned.trim() || rawName.trim();
}

/**
 * Remove ALL unicode emojis and pictographs from text for 100% clean, professional copy
 */
export function removeEmojis(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();
}

/**
 * Helper to get natural speaker introduction (avoids awkward "En Facundo Acosta...")
 */
export function getSpeakerIntro(senderName = '', agencyName = '') {
  const cleanSender = senderName ? senderName.trim() : '';
  const cleanAgency = agencyName ? agencyName.trim() : '';

  if (cleanSender && cleanAgency) {
    return `Soy ${cleanSender} de ${cleanAgency} y nos dedicamos a`;
  }
  if (cleanSender) {
    return `Mi nombre es ${cleanSender} y me dedico a`;
  }
  if (cleanAgency) {
    return `Desde ${cleanAgency} nos dedicamos a`;
  }
  return 'Nos especializamos en';
}

/**
 * Built-in Smart AI Copywriting Engine
 * Analyzes business metrics, web status, city, reviews and rubro to craft an authentic pitch.
 * Strictly 0 emojis, natural conversational Argentine/Latam Spanish, natural sender identity.
 */
export function generateBuiltInAIPitch(lead, options = {}) {
  const {
    tone = 'friendly',
    senderName = '',
    agencyName = '',
    customOffer = '',
    variant = 0,
    customInstruction = ''
  } = options;

  const businessName = cleanBusinessName(lead?.displayName || lead?.name || 'su negocio');
  const city = lead?.city || lead?.zona || 'su localidad';
  const rubro = lead?.rubro || lead?.primaryType || lead?.primaryTypeDisplayName || 'su rubro';
  const classification = lead?.classification?.type || (lead?.websiteUri ? 'HAS_WEB' : 'NO_WEB');
  const platform = lead?.classification?.platform || 'redes sociales';
  const rating = lead?.rating ? Number(lead.rating).toFixed(1) : null;

  const speakerIntro = getSpeakerIntro(senderName, agencyName);
  const defaultOffer = 'desarrollar páginas web y catálogos móviles ágiles, adaptados a celulares y con botón directo a WhatsApp';
  const offer = customOffer.trim() || defaultOffer;

  const variantIndex = Math.abs(Number(variant) || 0) % 3;

  // Adapt built-in copy if user provided a specific prompt instruction (ZERO emojis)
  if (customInstruction && typeof customInstruction === 'string') {
    const lower = customInstruction.toLowerCase();
    if (lower.includes('corto') || lower.includes('breve') || lower.includes('conciso') || lower.includes('resum')) {
      return removeEmojis(`Hola ${businessName}. Vi que tienen excelentes opiniones de clientes en Google Maps. Noté que hoy no cuentan con una web oficial y muchos vecinos de ${city} que buscan "${rubro}" desde el celular terminan escribiendo a otros comercios.\n\n${speakerIntro} ${offer}.\n\n¿Estarían interesados en sumar una web oficial para recibir más consultas directas por WhatsApp? Un saludo cordial.`);
    }
    if (lower.includes('delivery') || lower.includes('pedido') || lower.includes('carta') || lower.includes('menu') || lower.includes('menú')) {
      return removeEmojis(`Hola equipo de ${businessName}. Vi que tienen muy buenas reseñas en Google Maps en ${city}. Quienes buscan sus productos hoy quieren ver catálogo y pedir directo desde el celular. Al no tener una web rápida con botón de pedidos, se pierden ventas.\n\n${speakerIntro} ${offer}.\n\n¿Les interesaría sumar una web ágil para que los clientes vean sus opciones y hagan pedidos directo por WhatsApp? Saludos.`);
    }
    if (lower.includes('formal') || lower.includes('serio') || lower.includes('profesional')) {
      return removeEmojis(`Estimado equipo de ${businessName}, un gusto saludarlos. Analizando la presencia digital de ${rubro} en ${city}, destacamos las excelentes referencias de sus clientes en Google. Notamos que no disponen de un sitio web oficial adaptado a dispositivos móviles para canalizar consultas de manera directa hacia su WhatsApp corporativo.\n\n${speakerIntro} acercar soluciones digitales llave en mano para potenciar canales de atención directa.\n\n¿Estarían interesados en evaluar la incorporación de una plataforma web para su negocio? Quedamos a su entera disposición.`);
    }
  }

  // VARIANT 1: Enfoque Oportunidad Local & Pérdida de Clientes Móviles (Cero Emojis)
  if (variantIndex === 1) {
    const greeting = tone === 'direct'
      ? `Hola ${businessName}.`
      : `Buenas tardes equipo de ${businessName}. Les escribo brevemente desde la zona de ${city}.`;

    let hook = '';
    if (rating && Number(rating) >= 4.2) {
      hook = `Estuve revisando negocios de ${rubro} en Google Maps para la zona de ${city} y vi que tienen muy buenas reseñas y comentarios de sus clientes. Tienen un prestigio ganado indiscutible.`;
    } else {
      hook = `Buscando comercios de ${rubro} en Google Maps para la zona de ${city}, di con su ficha de negocio.`;
    }

    let problem = '';
    if (classification === 'NO_WEB') {
      problem = `Hoy en día más del 80% de los vecinos de ${city} buscan "${rubro}" directamente desde el celular antes de comprar. Quieren ver catálogo, horarios o servicios y tocar un botón para escribirles directo. Al no tener una página web propia vinculada a su perfil, muchísima gente duda o termina eligiendo a otros competidores que sí la tienen.`;
    } else if (classification === 'SOCIAL_ONLY') {
      problem = `Noté que canalizan a la gente hacia su perfil de ${platform}. Las redes son una buena herramienta, pero a un cliente nuevo que viene buscando resolver una urgencia en Google muchas veces le da pereza buscar publicaciones o no tiene la app instalada. Una web directa a WhatsApp convierte el doble.`;
    } else {
      problem = `Navegué su sitio actual y tiene muy buena información, aunque noté que en celulares tarda en cargar y le faltan botones directos a WhatsApp para capturar consultas rápidas antes de que el usuario cierre la pestaña.`;
    }

    const solution = `${speakerIntro} ${offer}, pensados para que cada persona que los busque en Google se convierta en una venta concreta.`;
    const cta = `¿Estarían interesados en sumar una web oficial para recibir más consultas directas por WhatsApp desde Google? ¿Te interesaría que te cuente cómo armarlo sin complicaciones?`;
    const closing = `Muchos éxitos con las ventas de esta semana.`;

    return removeEmojis(`${greeting}\n\n${hook}\n\n${problem}\n\n${solution}\n\n${cta}\n\n${closing}`);
  }

  // VARIANT 2: Enfoque Auditoría Rápida & Cero Riesgo (Cero Emojis)
  if (variantIndex === 2) {
    const greeting = tone === 'direct'
      ? `Hola equipo de ${businessName}.`
      : `Hola ${businessName}, espero que estén teniendo una excelente jornada.`;

    let hook = '';
    if (rating && Number(rating) >= 4.2) {
      hook = `Hicimos un relevamiento de comercios de ${rubro} en ${city} y su perfil de Google Maps resalta con fuerza por sus buenas reseñas y recomendaciones de clientes.`;
    } else {
      hook = `Encontré la ficha de ${businessName} en Google Maps analizando comercios del rubro ${rubro} en ${city}.`;
    }

    let problem = '';
    if (classification === 'NO_WEB') {
      problem = `Detectamos una fuga clara de oportunidades: no disponen de una web oficial propia. Quienes buscan sus productos en Google no encuentran un menú o catálogo claro ni un botón para contactarlos en 1 clic, perdiendo clientes diarios a favor de la competencia local.`;
    } else if (classification === 'SOCIAL_ONLY') {
      problem = `Notamos que su único enlace es a ${platform}. Si bien suma, depender 100% de redes hace que pierdan a clientes que buscan comprar ya mismo en Google y prefieren una experiencia web ágil y directa.`;
    } else {
      problem = `Hice una auditoría rápida de su web y encontramos oportunidades de mejora en posicionamiento local y velocidad en smartphones para que más visitas se traduzcan en mensajes de WhatsApp.`;
    }

    const solution = `${speakerIntro} ${offer}, llave en mano y sin complicaciones para ustedes.`;
    const cta = `¿Les interesaría conocer cómo podemos implementarlo para ${businessName} y empezar a captar esas consultas?`;
    const closing = `Un saludo cordial y a disposición.`;

    return removeEmojis(`${greeting}\n\n${hook}\n\n${problem}\n\n${solution}\n\n${cta}\n\n${closing}`);
  }

  // VARIANT 0 (Default): Enfoque Reputación & Conversión (Cero Emojis)
  const greeting = tone === 'direct' 
    ? `Hola equipo de ${businessName}.` 
    : `Hola ${businessName}, espero que estén teniendo una muy buena semana.`;

  let socialProofHook = '';
  if (rating && Number(rating) >= 4.2) {
    if (tone === 'friendly') {
      socialProofHook = `Estuve viendo su ficha en Google Maps de ${city} y vi que tienen muy buenas reseñas y comentarios de clientes. Se nota la dedicación y el buen servicio que brindan.`;
    } else if (tone === 'direct') {
      socialProofHook = `Vi que en Google Maps son un referente en ${city} y tienen excelentes opiniones de sus clientes. Tienen una demanda enorme de gente buscándolos.`;
    } else if (tone === 'consultant') {
      socialProofHook = `Analizando el mercado de ${rubro} en ${city}, encontré su perfil en Google Maps con muy buenas reseñas y recomendaciones de los usuarios.`;
    } else {
      socialProofHook = `Sigo de cerca a los principales negocios de ${rubro} en ${city} y me llamó positivamente la atención su perfil con tan buenas opiniones y comentarios.`;
    }
  } else {
    if (tone === 'friendly') {
      socialProofHook = `Estuve viendo su ficha comercial en Google Maps en la zona de ${city} y me pareció muy interesante la propuesta de ${businessName}.`;
    } else if (tone === 'direct') {
      socialProofHook = `Encontré a ${businessName} buscando proveedores de ${rubro} en ${city}.`;
    } else if (tone === 'consultant') {
      socialProofHook = `Estuve realizando un relevamiento digital de comercios de ${rubro} en ${city} y di con su ficha de Google Maps.`;
    } else {
      socialProofHook = `Nos especializamos en potenciar negocios de ${rubro} en ${city} y descubrí la ficha de ${businessName}.`;
    }
  }

  let problemAndOpportunity = '';
  if (classification === 'NO_WEB') {
    if (tone === 'friendly') {
      problemAndOpportunity = `Sin embargo, noté un detalle clave: todavía no cuentan con un sitio web oficial propio. Hoy en día, la mayoría de las personas que buscan "${rubro}" en Google desde su celular quieren ver rápido los servicios, catálogo o precios y tocar un botón para escribirles directo. Al no tener web, muchos clientes indecisos terminan yéndose con la competencia.`;
    } else if (tone === 'direct') {
      problemAndOpportunity = `El punto crítico es que hoy no tienen sitio web propio. Eso significa que cientos de búsquedas mensuales en Google de gente lista para comprar en ${city} se están perdiendo o las está captando otro comercio.`;
    } else if (tone === 'consultant') {
      problemAndOpportunity = `Detecté una oportunidad de mejora inmediata: no tienen página web vinculada a su ficha de Google. Tener un sitio propio optimizado aumentaría hasta un 40% las consultas directas por WhatsApp de usuarios locales.`;
    } else {
      problemAndOpportunity = `Notamos que su presencia se limita a la ficha de mapas sin un sitio web institucional. En un rubro tan competitivo como ${rubro}, un sitio web profesional marca la diferencia en confianza y conversión.`;
    }
  } else if (classification === 'SOCIAL_ONLY') {
    if (tone === 'friendly') {
      problemAndOpportunity = `Vi que enlazan su perfil de ${platform}. Las redes son útiles para generar comunidad, pero a un cliente nuevo que busca en Google muchas veces le cuesta encontrar rápido los servicios o precios. Una web propia les da presencia profesional 24/7 sin depender del algoritmo.`;
    } else if (tone === 'direct') {
      problemAndOpportunity = `Noté que solo usan ${platform}. Depender únicamente de redes para cerrar ventas hace que pierdan a todo el público que busca en Google con intención de compra inmediata y necesita respuestas claras en segundos.`;
    } else if (tone === 'consultant') {
      problemAndOpportunity = `Su enlace de contacto redirige a ${platform}. Aunque suma, no permite medir conversiones ni posicionar en Google para términos de búsqueda de ${rubro} en ${city}. Una web puente duplica la efectividad de sus redes.`;
    } else {
      problemAndOpportunity = `Observamos que canalizan su tráfico hacia ${platform}. Desarrollamos ecosistemas digitales donde el cliente pasa de Google a una landing page de alta conversión y de ahí directo a su WhatsApp.`;
    }
  } else {
    if (tone === 'friendly') {
      problemAndOpportunity = `Estuve navegando en su sitio web y me gustó su propuesta, aunque noté algunos puntos que se podrían modernizar: mejorar los tiempos de carga en teléfonos móviles y colocar llamadas a la acción más directas a WhatsApp para aumentar las consultas.`;
    } else if (tone === 'direct') {
      problemAndOpportunity = `Entré a su sitio web y noté oportunidades claras de optimización: carga lenta en celulares y falta de integración directa para cerrar ventas rápidas por WhatsApp.`;
    } else if (tone === 'consultant') {
      problemAndOpportunity = `Hice una auditoría rápida de su sitio web actual y detecté margen de mejora en velocidad móvil, experiencia de usuario y captación de leads locales en ${city}.`;
    } else {
      problemAndOpportunity = `Revisamos su web actual. Nos dedicamos a rediseñar y renovar plataformas web para ${rubro}, optimizándolas para SEO y máxima velocidad en celulares.`;
    }
  }

  let solutionStatement = `${speakerIntro} ${offer}, pensados específicamente para negocios de ${rubro} que quieren recibir más consultas y proyectar seriedad.`;

  let cta = '';
  if (tone === 'friendly') {
    cta = `¿Te interesaría que conversemos sobre cómo podemos armar una web para ${businessName} y empezar a captar esas consultas directas por WhatsApp?`;
  } else if (tone === 'direct') {
    cta = `¿Están interesados en ver cómo sumar una web optimizada para captar a los clientes que los buscan en Google en ${city}?`;
  } else if (tone === 'consultant') {
    cta = `¿Te interesaría conocer cómo podemos implementarlo para ${businessName} y aumentar las consultas directas por WhatsApp?`;
  } else {
    cta = `¿Estarían interesados en que conversemos brevemente para ver cómo potenciar la captación digital de ${businessName}? Quedo a su disposición.`;
  }

  const closing = tone === 'direct' 
    ? `Te mando un saludo y que sigan los éxitos.` 
    : `Un saludo cordial y muchos éxitos en las ventas.`;

  return removeEmojis(`${greeting}\n\n${socialProofHook}\n\n${problemAndOpportunity}\n\n${solutionStatement}\n\n${cta}\n\n${closing}`);
}

/**
 * Fetch list of active models accessible to the user's Groq API Key
 * @param {string} apiKey
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function fetchGroqModels(apiKey) {
  if (!apiKey || !apiKey.trim()) return [];
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.data)) return [];
    
    // Filter text/chat models (exclude whisper audio and guard models)
    return data.data
      .filter(m => {
        const id = (m.id || '').toLowerCase();
        return !id.includes('whisper') && !id.includes('guard') && m.active !== false;
      })
      .map(m => ({
        id: m.id,
        name: m.id
      }));
  } catch (err) {
    console.error('Error fetching Groq models:', err);
    return [];
  }
}

/**
 * Call Groq Cloud API (100% Free - Llama 3.1 8B Instant / Llama 3.3 70B)
 * Endpoint: https://api.groq.com/openai/v1/chat/completions
 */
async function callGroqAPI(apiKey, prompt, model = 'llama-3.1-8b-instant', promptParams = null) {
  let modelToUse = model || 'llama-3.1-8b-instant';
  // Groq decommissioned deepseek-r1-distill-llama-70b
  if (modelToUse === 'deepseek-r1-distill-llama-70b' || modelToUse.includes('deepseek-r1-distill')) {
    modelToUse = 'llama-3.1-8b-instant';
  }

  const systemMessage = 'Sos un redactor comercial experto en prospección B2B por WhatsApp en Argentina y Latinoamérica. Escribís propuestas comerciales humanas, cálidas, persuasivas y directas en español natural, listas para enviar por WhatsApp. REGLA ESTRICTA: CERO EMOJIS en todo el texto (está terminantemente prohibido usar emojis). Si hay un nombre personal de remitente, presentate naturalmente como "Soy [Nombre] y me dedico a...", jamás digas "En [Nombre]". Siempre entregás el texto final completo listo para enviar.';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelToUse,
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 1024,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errMsg = errorData.error?.message || `Error HTTP ${response.status} de Groq API`;

    // If model does not exist or user doesn't have access to 70B, auto-fallback to universal llama-3.1-8b-instant
    const isModelAccessError = errMsg.toLowerCase().includes('does not exist') || errMsg.toLowerCase().includes('do not have access');
    if (isModelAccessError && modelToUse !== 'llama-3.1-8b-instant') {
      console.warn(`[Groq] Modelo ${modelToUse} sin acceso en esta cuenta. Reintentando automáticamente con llama-3.1-8b-instant...`);
      return await callGroqAPI(apiKey, prompt, 'llama-3.1-8b-instant', promptParams);
    }

    throw new Error(errMsg);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  // Extract from content, reasoning, reasoning_content, or text
  let rawContent = choice?.message?.content 
    ?? choice?.message?.reasoning 
    ?? choice?.message?.reasoning_content 
    ?? choice?.text 
    ?? '';

  if (typeof rawContent !== 'string') {
    rawContent = String(rawContent || '');
  }

  // Handle think tags safely without deleting the message if it was placed inside think
  let reply = rawContent;
  if (reply.includes('<think>')) {
    const stripped = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    reply = stripped.length > 20 ? stripped : reply.replace(/<\/?think>/gi, '').trim();
  }
  reply = removeEmojis(reply.replace(/^["'`]|["'`]$/g, '').trim());

  // If response is still empty or whitespace, auto-retry once with a direct simplified prompt
  if (!reply || !reply.trim()) {
    console.warn('[Groq] Respuesta inicial vacía. Reintentando con prompt directo...');
    const bName = promptParams?.businessName || 'este comercio';
    const bRubro = promptParams?.rubro || 'su rubro';
    const bCity = promptParams?.city || 'su localidad';
    const currentDraft = promptParams?.currentPitch;

    const userNote = promptParams?.customInstruction ? ` Indicación extra del usuario: "${promptParams.customInstruction}".` : '';
    const retryPrompt = currentDraft
      ? `Reescribí este mensaje de WhatsApp para el negocio "${bName}" (${bRubro} en ${bCity}), haciéndolo más atractivo, cercano y persuasivo.${userNote} REGLAS: 1) CERO EMOJIS (PROHIBIDO usar emojis). 2) NO ofrezcas maquetas ni demos; cerrá preguntando si están interesados en sumar una web. 3) NO menciones números de estrellas ni de reseñas; decí 'vi que tienen muy buenas reseñas en Google'. 4) Si hay nombre de persona, decí 'Soy [Nombre] y me dedico a...', nunca 'En [Nombre]'.\n\n${currentDraft}\n\nEntregá únicamente el nuevo mensaje final listo para enviar.`
      : `Escribí un mensaje de prospección comercial en español para WhatsApp al dueño de "${bName}" (${bRubro} en ${bCity}).${userNote} REGLAS: 1) CERO EMOJIS (PROHIBIDO usar emojis). 2) Decí que viste que tienen muy buenas reseñas en Google (sin números de estrellas ni calificaciones). 3) Explicá que no tener web propia les hace perder clientes de Google. 4) Preguntá si estarían interesados en sumar una web para recibir más consultas directas por WhatsApp. ESTRICTAMENTE PROHIBIDO ofrecer maquetas. Entregá solo el mensaje listo para enviar.`;

    try {
      const retryRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'Sos un redactor comercial experto en WhatsApp B2B en español. CERO EMOJIS. Respondé únicamente con el texto del mensaje listo para enviar.'
            },
            {
              role: 'user',
              content: retryPrompt
            }
          ],
          temperature: 0.7,
          max_completion_tokens: 1024,
          max_tokens: 1024
        })
      });

      if (retryRes.ok) {
        const retryData = await retryRes.json();
        const retryChoice = retryData.choices?.[0];
        let retryRaw = retryChoice?.message?.content 
          ?? retryChoice?.message?.reasoning 
          ?? retryChoice?.message?.reasoning_content 
          ?? retryChoice?.text 
          ?? '';
        if (typeof retryRaw === 'string') {
          retryRaw = retryRaw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '').trim();
          retryRaw = retryRaw.replace(/^["'`]|["'`]$/g, '').trim();
        }
        if (retryRaw && retryRaw.trim().length > 0) {
          return removeEmojis(retryRaw);
        }
      }
    } catch (retryErr) {
      console.warn('[Groq] Falló el reintento directo:', retryErr);
    }
  }

  if (!reply || !reply.trim()) {
    throw new Error('La respuesta de Groq vino vacía');
  }

  return removeEmojis(reply);
}

/**
 * Call DeepSeek Official API (deepseek-chat)
 * Endpoint: https://api.deepseek.com/chat/completions
 */
async function callDeepSeekAPI(apiKey, prompt) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'Sos un redactor comercial experto en prospección B2B por WhatsApp en Argentina y Latinoamérica. Escribís mensajes fríos pero humanos, cercanos, persuasivos y sin sonar a spam ni a robot corporativo. REGLA ESTRICTA: CERO EMOJIS en todo el texto (terminantemente prohibido usar emojis). Si hay un nombre personal de remitente, presentate naturalmente en primera persona ("Soy [Nombre] y me dedico a..."), jamás digas "En [Nombre]". Mantenés un tono respetuoso, destacás elogios reales y terminás con una pregunta de bajo compromiso. Solo entregá el mensaje listo para enviar sin comentarios adicionales.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.75,
      max_tokens: 600
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error HTTP ${response.status} de DeepSeek API`);
  }

  const data = await response.json();
  let reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Respuesta vacía de DeepSeek');
  reply = removeEmojis(reply.trim().replace(/^["'`]|["'`]$/g, '').trim());

  return reply;
}

/**
 * Call Google Gemini API (Flash 1.5)
 */
async function callGeminiAPI(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 600
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error HTTP ${response.status} de Gemini API`);
  }

  const data = await response.json();
  let candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    throw new Error('La respuesta de Gemini vino vacía');
  }
  candidateText = removeEmojis(candidateText.trim().replace(/^["'`]|["'`]$/g, '').trim());

  return candidateText;
}

/**
 * Call OpenAI API (gpt-4o-mini)
 */
async function callOpenAIAPI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sos un redactor comercial experto en copywriting B2B para WhatsApp en Argentina y Latinoamérica. Escribís mensajes fríos pero humanos, cercanos, persuasivos y sin sonar a spam ni a robot corporativo. REGLA ESTRICTA: CERO EMOJIS (totalmente prohibido usar emojis). Si hay un nombre personal de remitente, presentate naturalmente en primera persona ("Soy [Nombre] y me dedico a..."), jamás digas "En [Nombre]". Mantenés un tono respetuoso, destacás elogios reales y terminás con una pregunta de bajo compromiso. Solo entregá el mensaje listo para enviar.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.75,
      max_tokens: 600
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error HTTP ${response.status} de OpenAI API`);
  }

  const data = await response.json();
  let reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Respuesta vacía de OpenAI');
  reply = removeEmojis(reply.trim().replace(/^["'`]|["'`]$/g, '').trim());

  return reply;
}

/**
 * Build universal prompt for external LLMs
 */
function buildLLMPrompt(params) {
  const {
    businessName,
    rubro,
    city,
    classification,
    platform,
    rating,
    reviews,
    toneObj,
    senderName,
    agencyName,
    customOffer,
    currentPitch,
    customInstruction
  } = params;

  const reputationContext = (rating && Number(rating) >= 4.0)
    ? `Tienen muy buenas reseñas (${rating} estrellas${reviews ? ` y ${reviews} opiniones` : ''}) en Google`
    : 'Ficha comercial activa en Google Maps';

  const customInstructionBlock = customInstruction && customInstruction.trim()
    ? `
INDICACIÓN ESPECIAL DEL USUARIO (MÁXIMA PRIORIDAD):
"${customInstruction.trim()}"
(Debés adaptar o reescribir el mensaje cumpliendo puntualmente con esta instrucción del usuario, respetando siempre las reglas de cero emojis, no ofrecer maquetas y no incluir calificaciones numéricas).
`
    : '';

  const speakerGuidance = senderName 
    ? (agencyName 
        ? `- Remitente: ${senderName} de la agencia/equipo "${agencyName}". Presentarse naturalmente: "Soy ${senderName} de ${agencyName} y nos dedicamos a..."`
        : `- Remitente: ${senderName}. IMPORTANTE: Es una persona individual. NUNCA digas "En ${senderName} hacemos/diseñamos..." porque suena artificial e incorrecto. Presentate naturalmente en primera persona: "Mi nombre es ${senderName} y me dedico a..." o "Soy ${senderName}, trabajo desarrollando..."`)
    : (agencyName ? `- Agencia o Equipo: ${agencyName}. Podés decir "Desde ${agencyName} nos dedicamos a..."` : '- Remitente: Profesional o equipo de desarrollo web');

  return `Actuá como un redactor comercial experto en prospección B2B por WhatsApp en Argentina y Latinoamérica.
Tu objetivo es escribir un mensaje altamente personalizado, cálido y persuasivo para enviar por WhatsApp al dueño o encargado de este negocio:

DATOS DEL NEGOCIO:
- Nombre: "${businessName}"
- Rubro: "${rubro}"
- Ciudad / Zona: "${city}"
- Estado web: ${classification === 'NO_WEB' ? 'No tiene sitio web oficial propio' : (classification === 'SOCIAL_ONLY' ? `Solo usa redes sociales (${platform})` : 'Tiene sitio web pero se puede modernizar para celulares')}
- Reputación en Google: ${reputationContext}
- Enfoque deseado: ${toneObj?.name || 'Cercano'} (${toneObj?.desc || 'Cálido y empático'})
${speakerGuidance}
${customOffer ? `- Oferta a proponer: ${customOffer}` : '- Oferta: Sitios webs modernos, ultra rápidos, adaptados a celulares y con botón a WhatsApp para convertir búsquedas de Google en ventas'}
${customInstructionBlock}
${currentPitch?.trim() ? `PROPUESTA ACTUAL A MEJORAR:
"""
${currentPitch.trim()}
"""

OBJETIVO DE REESCRITURA:
Reescribí por completo este mensaje para WhatsApp sin emojis. Dale un giro fresco con un saludo diferente, elogiá que viste sus buenas reseñas en Google, hacé la propuesta ágil y directa, y cerrá preguntando si están interesados en sumar una web.` : 'OBJETIVO: Redactá desde cero una propuesta comercial fresca, única y persuasiva para este comercio.'}

REGLAS ESTRICTAS DE REDACCIÓN (OBLIGATORIAS):
1. REGLA CERO EMOJIS (ESTRICTA): ESTÁ TERMINANTEMENTE PROHIBIDO USAR CUALQUIER TIPO DE EMOJI O EMOTICONO en todo el mensaje. No pongas manos, caritas, cohetes, teléfonos, estrellas ni ningún emoji. El texto debe ser 100% texto limpio, sobrio y profesional.
2. REGLA DE IDENTIDAD DEL REMITENTE (ESTRICTA): Si se especifica un nombre personal (como Facundo Acosta), NUNCA digas "En Facundo Acosta tal cosa" porque suena artificial e incoherente. Debe presentarse con naturalidad diciendo "Soy Facundo Acosta y me dedico a..." o "Mi nombre es Facundo Acosta y trabajo desarrollando páginas web...".
3. REGLA DE RESEÑAS (ESTRICTA): ESTÁ PROHIBIDO mencionar la calificación numérica o cantidad de opiniones (NUNCA pongas "4.8 estrellas", "4.5", "30 reseñas", "promedio de 5", etc.). En su lugar, elogiá su reputación de forma natural diciendo algo como "vi que tienen muy buenas reseñas en Google", "vi que tienen excelentes opiniones de clientes" o "vi los muy buenos comentarios que les dejan en Google".
4. REGLA DE CIERRE / CTA (ESTRICTA): ESTÁ TERMINANTEMENTE PROHIBIDO ofrecer "maquetas", "maquetas de 1 minuto", "bocetos previos", "demostraciones" o "muestras". El cierre DEBE ser una pregunta simple y directa consultando si están interesados en sumar una web o si les gustaría conocer cómo armarlo para captar más consultas por WhatsApp (por ejemplo: "¿Te interesaría que te cuente cómo podemos implementarlo para ${businessName}?", "¿Estarían interesados en sumar una web oficial para recibir más consultas directas por WhatsApp?", "¿Te gustaría conocer cómo armarlo para captar a la gente que los busca en Google?").
5. El mensaje debe sonar 100% natural, como escrito por una persona real en español rioplatense o latino cálido, nunca como bot corporativo ni spam.
6. Explicá con empatía por qué no tener web propia (o depender solo de redes) hace que quienes buscan "${rubro}" en Google desde el celular terminen con la competencia.
7. Planteá la solución en 1 o 2 oraciones breves y claras.
8. Formato limpio con saltos de línea claros y párrafos cortos. Longitud: entre 65 y 130 palabras.
9. ENTREGÁ DIRECTAMENTE EL MENSAJE FINAL LISTO PARA ENVIAR POR WHATSAPP. No incluyas introducciones, títulos, ni notas explicativas.`;
}

/**
 * Main AI Pitch Generation Dispatcher
 * @param {object} lead - Lead object
 * @param {object} options - AI generation options & credentials
 * @returns {Promise<{ success: boolean, pitch: string, provider: string, isFallback?: boolean, error?: string, missingKey?: boolean }>}
 */
export async function generateAIPitch(lead, options = {}) {
  const {
    provider = 'builtin',
    groqApiKey = '',
    groqModel = 'llama-3.1-8b-instant',
    deepseekApiKey = '',
    geminiApiKey = '',
    openaiApiKey = '',
    tone = 'friendly',
    senderName = '',
    agencyName = '',
    customOffer = '',
    currentPitch = '',
    customInstruction = '',
    _variant = 0
  } = options;

  const businessName = cleanBusinessName(lead?.displayName || lead?.name || 'su negocio');
  const city = lead?.city || lead?.zona || 'su localidad';
  const rubro = lead?.rubro || lead?.primaryType || lead?.primaryTypeDisplayName || 'Comercio';
  const classification = lead?.classification?.type || (lead?.websiteUri ? 'HAS_WEB' : 'NO_WEB');
  const platform = lead?.classification?.platform || 'redes sociales';
  const rating = lead?.rating ? Number(lead.rating).toFixed(1) : null;
  const reviews = lead?.userRatingCount || lead?.reviews || 0;
  const toneObj = AI_TONES.find(t => t.id === tone) || AI_TONES[0];

  const promptParams = {
    businessName,
    rubro,
    city,
    classification,
    platform,
    rating,
    reviews,
    toneObj,
    senderName,
    agencyName,
    customOffer,
    currentPitch,
    customInstruction
  };

  // 1. External LLM: Groq (Llama 3.1 8B Instant - 100% Gratis)
  if (provider === 'groq') {
    const key = groqApiKey?.trim();
    if (!key) {
      return {
        success: false,
        error: 'Falta la API Key de Groq. Ingresala en Configuración ⚙️ (es gratis en console.groq.com) o seleccioná "Smart AI B2B" para redactar sin clave.',
        missingKey: true,
        provider: 'groq'
      };
    }
    try {
      const prompt = buildLLMPrompt(promptParams);
      const aiText = await callGroqAPI(key, prompt, groqModel, promptParams);
      return {
        success: true,
        pitch: aiText,
        provider: 'groq'
      };
    } catch (err) {
      console.warn('Groq API call failed, activating Smart AI fallback:', err);
      // Auto-fallback with variant rotation so the user ALWAYS gets a fresh, high-converting pitch
      const fallbackPitch = generateBuiltInAIPitch(lead, {
        ...options,
        variant: ((options.variant || 0) + 1) % 3
      });
      return {
        success: true,
        pitch: fallbackPitch,
        provider: 'groq',
        isFallback: true,
        fallbackReason: err.message
      };
    }
  }

  // 2. External LLM: DeepSeek Official API
  if (provider === 'deepseek') {
    const key = deepseekApiKey?.trim();
    if (!key) {
      return {
        success: false,
        error: 'Falta la API Key de DeepSeek Oficial. Ingresala en Configuración ⚙️ o seleccioná Smart AI.',
        missingKey: true,
        provider: 'deepseek'
      };
    }
    try {
      const prompt = buildLLMPrompt(promptParams);
      const aiText = await callDeepSeekAPI(key, prompt);
      return {
        success: true,
        pitch: aiText,
        provider: 'deepseek'
      };
    } catch (err) {
      console.warn('DeepSeek API call failed, activating Smart AI fallback:', err);
      const fallbackPitch = generateBuiltInAIPitch(lead, {
        ...options,
        variant: ((options.variant || 0) + 1) % 3
      });
      return {
        success: true,
        pitch: fallbackPitch,
        provider: 'deepseek',
        isFallback: true,
        fallbackReason: err.message
      };
    }
  }

  // 3. External LLM: Google Gemini
  if (provider === 'gemini') {
    const key = geminiApiKey?.trim();
    if (!key) {
      return {
        success: false,
        error: 'Falta la API Key de Google Gemini. Ingresala en Configuración ⚙️ (gratis en Google AI Studio) o usá Smart AI.',
        missingKey: true,
        provider: 'gemini'
      };
    }
    try {
      const prompt = buildLLMPrompt(promptParams);
      const aiText = await callGeminiAPI(key, prompt);
      return {
        success: true,
        pitch: aiText,
        provider: 'gemini'
      };
    } catch (err) {
      console.warn('Gemini API call failed, activating Smart AI fallback:', err);
      const fallbackPitch = generateBuiltInAIPitch(lead, {
        ...options,
        variant: ((options.variant || 0) + 1) % 3
      });
      return {
        success: true,
        pitch: fallbackPitch,
        provider: 'gemini',
        isFallback: true,
        fallbackReason: err.message
      };
    }
  }

  // 4. External LLM: OpenAI
  if (provider === 'openai') {
    const key = openaiApiKey?.trim();
    if (!key) {
      return {
        success: false,
        error: 'Falta la API Key de OpenAI. Ingresala en Configuración ⚙️ o usá Smart AI.',
        missingKey: true,
        provider: 'openai'
      };
    }
    try {
      const prompt = buildLLMPrompt(promptParams);
      const aiText = await callOpenAIAPI(key, prompt);
      return {
        success: true,
        pitch: aiText,
        provider: 'openai'
      };
    } catch (err) {
      console.warn('OpenAI API call failed, activating Smart AI fallback:', err);
      const fallbackPitch = generateBuiltInAIPitch(lead, {
        ...options,
        variant: ((options.variant || 0) + 1) % 3
      });
      return {
        success: true,
        pitch: fallbackPitch,
        provider: 'openai',
        isFallback: true,
        fallbackReason: err.message
      };
    }
  }

  // 5. Built-in Smart Copywriting Engine (Default, Instant, No key needed)
  const pitch = generateBuiltInAIPitch(lead, options);
  return {
    success: true,
    pitch,
    provider: 'builtin',
    toString() { return this.pitch; }
  };
}

/**
 * Test connectivity and credentials with any supported LLM provider
 * @param {string} provider - 'groq' | 'deepseek' | 'gemini' | 'openai'
 * @param {string} apiKey - API key
 * @param {string} model - Optional model
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function testLLMConnection(provider, apiKey, model = '') {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'La clave de API no puede estar vacía.' };
  }
  const cleanKey = apiKey.trim();
  const start = Date.now();
  try {
    if (provider === 'groq') {
      let activeModel = (!model || model.includes('deepseek-r1-distill')) 
        ? 'llama-3.1-8b-instant' 
        : model;

      try {
        await callGroqAPI(cleanKey, 'Respondé solo con la palabra OK.', activeModel);
        const timeMs = Date.now() - start;
        return { 
          success: true, 
          message: `¡Conexión exitosa con Groq (${timeMs}ms)! El modelo ${activeModel} está activo y listo para redactar.`,
          detectedModel: activeModel
        };
      } catch (firstErr) {
        // If the selected model (e.g. 70B) is not accessible, test llama-3.1-8b-instant
        if (activeModel !== 'llama-3.1-8b-instant') {
          try {
            await callGroqAPI(cleanKey, 'Respondé solo con la palabra OK.', 'llama-3.1-8b-instant');
            const timeMs = Date.now() - start;
            return {
              success: true,
              message: `Tu cuenta no tiene habilitado "${activeModel}", pero se activó automáticamente "llama-3.1-8b-instant" (${timeMs}ms), que funciona al 100% en tu cuenta.`,
              detectedModel: 'llama-3.1-8b-instant'
            };
          } catch {
            // If fallback also fails, throw original error
          }
        }
        throw firstErr;
      }
    }
    if (provider === 'deepseek') {
      await callDeepSeekAPI(cleanKey, 'Respondé solo con la palabra OK.');
      const timeMs = Date.now() - start;
      return { 
        success: true, 
        message: `¡Conexión exitosa con DeepSeek Oficial (${timeMs}ms)!` 
      };
    }
    if (provider === 'gemini') {
      await callGeminiAPI(cleanKey, 'Respondé solo con la palabra OK.');
      const timeMs = Date.now() - start;
      return { 
        success: true, 
        message: `¡Conexión exitosa con Google Gemini (${timeMs}ms)!` 
      };
    }
    if (provider === 'openai') {
      await callOpenAIAPI(cleanKey, 'Respondé solo con la palabra OK.');
      const timeMs = Date.now() - start;
      return { 
        success: true, 
        message: `¡Conexión exitosa con OpenAI (${timeMs}ms)!` 
      };
    }
    return { success: true, message: 'Motor Smart AI nativo activo.' };
  } catch (err) {
    return { 
      success: false, 
      message: `Fallo de conexión (${provider}): ${err.message}` 
    };
  }
}

/**
 * Batch generate personalized AI pitches for an array of leads
 * Prioritizes businesses without website or only with social networks.
 * Runs with concurrency throttling to prevent rate limiting with external LLM APIs.
 *
 * @param {Array<object>} leads - Array of lead objects
 * @param {object} options - AI settings and credentials
 * @param {function} onProgress - Callback ({ current, total, lead, pitch })
 * @returns {Promise<Array<object>>}
 */
export async function generateBatchPitches(leads, options = {}, onProgress = null) {
  if (!Array.isArray(leads) || leads.length === 0) return [];

  const results = [...leads];
  const total = leads.length;
  let completed = 0;

  // For built-in engine: instant parallel execution. For external LLMs: concurrency of 2
  const isExternal = options.provider && options.provider !== 'builtin';
  const concurrency = isExternal ? 2 : 10;

  for (let i = 0; i < leads.length; i += concurrency) {
    const chunk = leads.slice(i, i + concurrency);

    await Promise.all(
      chunk.map(async (lead, offset) => {
        const index = i + offset;
        try {
          const res = await generateAIPitch(lead, options);
          const cleanPitch = removeEmojis(res.pitch || '');
          results[index] = {
            ...lead,
            pregeneratedPitch: cleanPitch,
            customPitch: cleanPitch,
            pitchProvider: res.provider
          };
          completed++;
          if (typeof onProgress === 'function') {
            onProgress({ current: completed, total, lead: results[index], pitch: cleanPitch });
          }
        } catch (err) {
          console.warn(`[Batch Pitch] Fallback para ${lead.displayName}:`, err);
          const fallbackPitch = removeEmojis(generateBuiltInAIPitch(lead, options));
          results[index] = {
            ...lead,
            pregeneratedPitch: fallbackPitch,
            customPitch: fallbackPitch,
            pitchProvider: 'builtin_fallback'
          };
          completed++;
          if (typeof onProgress === 'function') {
            onProgress({ current: completed, total, lead: results[index], pitch: fallbackPitch });
          }
        }
      })
    );

    // Rate-limiting buffer for external APIs
    if (isExternal && i + concurrency < leads.length) {
      await new Promise(r => setTimeout(r, 650));
    }
  }

  return results;
}



