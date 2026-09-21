import { Mistral } from '@mistralai/mistralai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.MISTRAL_API_KEY;

if (!apiKey) {
  console.warn('⚠️ Warning: MISTRAL_API_KEY is not set in .env file');
}

export const mistralClient = new Mistral({ apiKey });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callWithRetry(fn, maxRetries = 3, delayMs = 1500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.message?.includes('429') || error.rawResponse?.status === 429;
      if (isRateLimit && attempt < maxRetries) {
        console.warn(`⏳ Rate limited (429), retrying in ${delayMs * attempt}ms...`);
        await sleep(delayMs * attempt);
        continue;
      }
      throw error;
    }
  }
}

/**
 * Generate embedding vector using Mistral embedding model (dimension: 1024)
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function generateEmbeddings(texts) {
  const response = await callWithRetry(() =>
    mistralClient.embeddings.create({
      model: 'mistral-embed',
      inputs: texts,
    })
  );

  return response.data.map(item => item.embedding);
}

/**
 * Chat with Mistral LLM
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>}
 */
export async function chatCompletion(messages) {
  // Berikan sedikit jeda sebelum request chat agar tidak menabrak batas 1 RPS
  await sleep(1000);

  const response = await callWithRetry(() =>
    mistralClient.chat.complete({
      model: 'open-mistral-7b',
      messages,
      temperature: 0.2, // Rendah agar lebih faktual dan tidak berhalusinasi
    })
  );

  return response.choices[0].message.content;
}

/**
 * Stream Chat with Mistral LLM (Server-Sent Events / SSE)
 * @param {Array<{role: string, content: string}>} messages
 * @returns {AsyncGenerator<string>}
 */
export async function* chatCompletionStream(messages) {
  await sleep(500);

  const stream = await mistralClient.chat.stream({
    model: 'open-mistral-7b',
    messages,
    temperature: 0.2,
  });

  for await (const chunk of stream) {
    const token = chunk.data.choices[0]?.delta?.content;
    if (token) {
      yield token;
    }
  }
}
