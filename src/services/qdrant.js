import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;

if (!qdrantUrl) {
  console.warn('⚠️ Warning: QDRANT_URL is not set in environment variables.');
}

export const qdrant = new QdrantClient({
  url: qdrantUrl,
  apiKey: qdrantApiKey,
});

export const DEFAULT_COLLECTION = 'jdih_documents';

/**
 * Memastikan collection di Qdrant sudah dibuat dengan dimensi dan metric yang sesuai.
 */
export async function ensureCollection(collectionName = DEFAULT_COLLECTION, vectorSize = 1024) {
  try {
    const collectionsResponse = await qdrant.getCollections();
    const exists = collectionsResponse.collections.some(c => c.name === collectionName);

    if (!exists) {
      console.log(`📦 Creating Qdrant collection "${collectionName}" with ${vectorSize} dimensions (Cosine)...`);
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
      console.log(`✅ Collection "${collectionName}" created successfully!`);
    } else {
      console.log(`ℹ️ Qdrant collection "${collectionName}" already exists.`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Failed to ensure Qdrant collection "${collectionName}":`, error.message);
    throw error;
  }
}

/**
 * Batch upsert points (vektor + metadata) ke Qdrant Cloud
 */
export async function upsertDocumentChunks(collectionName = DEFAULT_COLLECTION, points = []) {
  if (!points.length) return { status: 'empty' };

  // Qdrant batch limit: batch in groups of 50
  const batchSize = 50;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await qdrant.upsert(collectionName, {
      wait: true,
      points: batch,
    });
  }

  return { status: 'completed', totalPoints: points.length };
}

/**
 * Cari top-K potongan teks yang paling relevan berdasarkan queryVector
 */
export async function searchChunks(collectionName = DEFAULT_COLLECTION, queryVector, limit = 4, filter = null) {
  const searchParams = {
    vector: queryVector,
    limit,
    with_payload: true,
  };

  if (filter) {
    searchParams.filter = filter;
  }

  const results = await qdrant.search(collectionName, searchParams);

  return results.map(hit => ({
    id: hit.id,
    score: hit.score,
    heading: hit.payload?.heading || 'Umum',
    text: hit.payload?.text || '',
    documentTitle: hit.payload?.documentTitle || 'Dokumen Tanpa Judul',
    documentNumber: hit.payload?.documentNumber || 'N/A',
    category: hit.payload?.category || 'Peraturan',
    pageNumber: hit.payload?.pageNumber || 1,
    type: hit.payload?.type || 'CompositeElement',
  }));
}
