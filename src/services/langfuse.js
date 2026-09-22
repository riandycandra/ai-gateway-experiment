import { Langfuse } from 'langfuse';
import dotenv from 'dotenv';

dotenv.config();

const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;
const baseUrl = process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com';

export const isLangfuseEnabled = Boolean(publicKey && secretKey && publicKey !== 'pk-lf-xxxx');

let langfuseClient = null;

if (isLangfuseEnabled) {
  try {
    langfuseClient = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      flushInterval: 2000,
    });
    console.log(`[Langfuse] Initialized successfully. Connected to ${baseUrl}`);
  } catch (err) {
    console.warn('[Langfuse] Failed to initialize client:', err.message);
  }
} else {
  console.log('[Langfuse] API keys not provided or set to placeholder. Operating in no-op mock mode.');
}

/**
 * Creates a mock span/generation/trace to prevent undefined errors when keys are not configured.
 */
function createMockTrace(traceId = `mock_trace_${Date.now()}`) {
  const mockChild = {
    id: `mock_${Date.now()}`,
    update: () => mockChild,
    end: () => mockChild,
  };

  return {
    id: traceId,
    update: () => {},
    span: () => mockChild,
    generation: () => mockChild,
    event: () => mockChild,
    score: async () => {},
    getTraceUrl: () => `https://cloud.langfuse.com (no-op: keys not configured)`,
  };
}

/**
 * Start a hierarchical trace for an incoming chat request
 */
export function createChatTrace({ sessionId, userId, app, message, tags = [] }) {
  if (!isLangfuseEnabled || !langfuseClient) {
    return createMockTrace();
  }

  try {
    return langfuseClient.trace({
      name: `chat-pipeline-${app || 'general'}`,
      sessionId,
      userId: userId || 'anonymous',
      input: {
        message,
        app,
      },
      tags: [app || 'general', ...tags],
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        source: 'ai-gateway',
      },
    });
  } catch (error) {
    console.error('[Langfuse] Error creating trace:', error);
    return createMockTrace();
  }
}

/**
 * Send a score to Langfuse by trace ID or directly via Trace object
 */
export async function sendTraceScore({ trace, traceId, name, value, comment, dataType = 'NUMERIC' }) {
  if (!isLangfuseEnabled || !langfuseClient) return;

  try {
    if (trace && typeof trace.score === 'function') {
      await trace.score({
        name,
        value,
        comment,
        dataType,
      });
    } else if (traceId) {
      await langfuseClient.score({
        traceId,
        name,
        value,
        comment,
        dataType,
      });
    }
  } catch (err) {
    console.warn(`[Langfuse] Failed to record score "${name}":`, err.message);
  }
}

/**
 * Flush all pending events to Langfuse Cloud
 */
export async function flushLangfuse() {
  if (!isLangfuseEnabled || !langfuseClient) return;
  try {
    await langfuseClient.flushAsync();
  } catch (err) {
    console.warn('[Langfuse] Error flushing events:', err.message);
  }
}

export const langfuse = langfuseClient;
