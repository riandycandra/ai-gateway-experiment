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
  const text = userMessage.trim().toLowerCase();

  // 1. Check for basic greetings / chit-chat
  const greetingPatterns = [
    /^(halo|hai|hi|hello|hei|pagi|siang|sore|malam|assalamualaikum|tes|test|ping)$/i,
    /^(selamat\s+(pagi|siang|sore|malam|hari))$/i,
    /^(halo\s+selamat\s+(pagi|siang|sore|malam))$/i,
    /^(siapa kamu|kamu siapa|kamu bot apa|siapa anda)$/i,
  ];

  if (greetingPatterns.some(pattern => pattern.test(text))) {
    return {
      intent: 'GREETING',
      action: 'DIRECT_REPLY',
      directResponse: 'Halo! Saya adalah Asisten Virtual AI Perusahaan. Ada peraturan atau informasi perusahaan yang ingin Anda tanyakan?',
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
