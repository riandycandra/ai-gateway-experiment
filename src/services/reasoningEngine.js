/**
 * Guardrail check for malicious inputs, prompt injections, or jailbreak attempts
 */
export function guardrailCheck(userMessage) {
  const normalized = userMessage.toLowerCase();

  const injectionPatterns = [
    /ignore (all )?(previous|above) instructions/i,
    /system prompt/i,
    /reveal your instructions/i,
    /bypass guardrails/i,
    /lupakan instruksi sebelumnya/i,
    /bocorkan source code/i,
    /tampilkan api key/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(normalized)) {
      return {
        isSafe: false,
        reason: 'Pesan Anda mengandung instruksi yang tidak diizinkan oleh sistem keamanan.',
      };
    }
  }

  return { isSafe: true };
}

/**
 * Fast Rule-Based / Semantic Planner to determine user intent
 * Keeps latency low (0ms) for common patterns before routing
 */
export function planUserIntent(userMessage, targetApp = 'jdih') {
  // Bersihkan tanda baca untuk pencocokan intent
  const text = userMessage.trim().toLowerCase().replace(/[?!.,;:]/g, '');

  // 1. Check for identity queries (Who are you?)
  if (/^(siapa kamu|kamu siapa|kamu bot apa|siapa anda|perkenalkan diri)$/i.test(text)) {
    return {
      intent: 'GREETING',
      action: 'DIRECT_REPLY',
      directResponse: `Halo! Saya adalah **AI Gateway Assistant** resmi perusahaan.

Saya terhubung langsung dengan basis pengetahuan hukum & regulasi (**JDIH**) serta sistem internal perusahaan. Saya dapat membantu menjawab pertanyaan seputar:
- **Ketentuan Waktu Kerja & Presensi** (jam kerja, toleransi keterlambatan, sanksi)
- **Hak Cuti Karyawan** (cuti tahunan, sakit, menikah, melahirkan)
- **Tata Tertib & Disiplin** perusahaan

Ada yang ingin Anda ketahui terkait kebijakan perusahaan hari ini?`,
    };
  }

  // 2. Check for greetings & chit-chat
  const greetingRegex = /^(halo|hai|hi|hello|hei|pagi|siang|sore|malam|assalamualaikum|tes|test|ping|selamat\s+(pagi|siang|sore|malam|hari)|halo\s+selamat\s+(pagi|siang|sore|malam))$/i;
  if (greetingRegex.test(text)) {
    return {
      intent: 'GREETING',
      action: 'DIRECT_REPLY',
      directResponse: generateDynamicGreeting(text),
    };
  }

  // 2. Route based on context/app
  if (targetApp === 'jdih') {
    return {
      intent: 'JDIH_LEGAL',
      action: 'RETRIEVE_AND_GENERATE',
    };
  }

  if (targetApp === 'hc') {
    return {
      intent: 'HC_HR',
      action: 'TOOL_EXECUTION',
    };
  }

  return {
    intent: 'UNKNOWN',
    action: 'RETRIEVE_AND_GENERATE',
  };
}

/**
 * Generate context-aware and time-sensitive friendly greetings
 */
function generateDynamicGreeting(text) {
  // Respect religious/formal salutations
  if (text.includes('assalamualaikum')) {
    return 'Waalaikumsalam! Selamat datang di Asisten AI Perusahaan. Ada informasi regulasi atau peraturan kerja yang bisa saya bantu jelaskan?';
  }

  // Determine time of day in Indonesian
  const currentHour = new Date().getHours();
  let timeSalutation = 'hari';
  if (currentHour >= 4 && currentHour < 11) {
    timeSalutation = 'pagi';
  } else if (currentHour >= 11 && currentHour < 15) {
    timeSalutation = 'siang';
  } else if (currentHour >= 15 && currentHour < 18) {
    timeSalutation = 'sore';
  } else {
    timeSalutation = 'malam';
  }

  const variations = [
    `Halo, selamat ${timeSalutation}! Ada yang bisa saya bantu terkait peraturan perusahaan, hak cuti, atau jam kerja hari ini?`,
    `Selamat ${timeSalutation}! Saya siap membantu Anda mencari informasi kebijakan dan peraturan internal perusahaan. Silakan ajukan pertanyaan Anda.`,
    `Halo! Senang bisa membantu Anda. Apakah Anda ingin menanyakan hal seputar presensi, ketentuan cuti, atau tata tertib kantor?`,
    `Hai, selamat ${timeSalutation}! Butuh bantuan untuk mengecek pasal peraturan perusahaan atau ketentuan kerja? Tanyakan saja di sini.`,
  ];

  // Pick pseudo-random variation
  const index = Math.floor(Math.random() * variations.length);
  return variations[index];
}
