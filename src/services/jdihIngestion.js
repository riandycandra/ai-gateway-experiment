import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { pool } from '../db.js';
import { generateEmbeddings } from './mistral.js';

/**
 * Structure-Aware Text Chunking sederhana untuk dokumen regulasi / peraturan:
 * Memisahkan teks berdasarkan BAB / PASAL / Paragraf agar konteks pasal tidak terpotong sembarangan.
 */
function chunkRegulationText(fullText, maxChunkLength = 800) {
  // Split berdasarkan pattern "Pasal", "BAB", atau double newline
  const rawSections = fullText.split(/(?=(?:BAB\s+[IVXLCDM]+|Pasal\s+\d+))/i);
  const chunks = [];

  for (const section of rawSections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Deteksi judul heading (misal "Pasal 12" atau "BAB II")
    const match = trimmed.match(/^(BAB\s+[IVXLCDM]+.*?|Pasal\s+\d+.*?)(?:\n|$)/i);
    const heading = match ? match[1].trim() : 'Ketentuan Umum';

    // Jika panjangnya masih di dalam batas, masukkan sebagai 1 chunk
    if (trimmed.length <= maxChunkLength) {
      chunks.push({ text: trimmed, heading });
    } else {
      // Jika terlalu panjang, potong per paragraf dengan preserve heading
      const paragraphs = trimmed.split(/\n\s*\n/);
      let current = '';

      for (const p of paragraphs) {
        if ((current + '\n\n' + p).length <= maxChunkLength) {
          current = current ? `${current}\n\n${p}` : p;
        } else {
          if (current) chunks.push({ text: current.trim(), heading });
          current = p;
        }
      }
      if (current) {
        chunks.push({ text: current.trim(), heading });
      }
    }
  }

  return chunks;
}

/**
 * Ingest document (PDF atau text biasa) ke PostgreSQL Vector Database
 */
export async function ingestDocument({ filePath, title, documentNumber, category = 'Peraturan Perusahaan' }) {
  console.log(`\n📄 Ingesting document: "${title}" (${filePath})...`);

  let textContent = '';
  if (filePath.endsWith('.pdf')) {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    textContent = pdfData.text;
  } else {
    textContent = fs.readFileSync(filePath, 'utf-8');
  }

  // 1. Simpan metadata dokumen ke tabel `jdih_documents`
  const docResult = await pool.query(
    `INSERT INTO jdih_documents (title, document_number, category) 
     VALUES ($1, $2, $3) RETURNING id`,
    [title, documentNumber, category]
  );
  const documentId = docResult.rows[0].id;
  console.log(`✅ Saved document metadata with ID: ${documentId}`);

  // 2. Lakukan Structure-Aware Chunking
  const chunks = chunkRegulationText(textContent);
  console.log(`🧩 Total chunks generated: ${chunks.length}`);

  // 3. Generate Vector Embeddings via Mistral
  console.log('🤖 Generating embeddings via Mistral AI...');
  const textsToEmbed = chunks.map(c => `${c.heading}: ${c.text}`);
  
  // Mistral API batch limit: process in batches of 16 chunks
  const batchSize = 16;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const chunkBatch = chunks.slice(i, i + batchSize);
    const textBatch = textsToEmbed.slice(i, i + batchSize);

    const embeddings = await generateEmbeddings(textBatch);

    // 4. Simpan ke tabel `jdih_chunks`
    for (let j = 0; j < chunkBatch.length; j++) {
      const chunk = chunkBatch[j];
      const embeddingVector = JSON.stringify(embeddings[j]);

      await pool.query(
        `INSERT INTO jdih_chunks (document_id, chunk_text, heading, embedding)
         VALUES ($1, $2, $3, $4)`,
        [documentId, chunk.text, chunk.heading, embeddingVector]
      );
    }
    console.log(`   Saved chunks ${i + 1} to ${Math.min(i + batchSize, chunks.length)}`);
  }

  console.log(`🎉 Document "${title}" successfully ingested and indexed!`);
  return { documentId, totalChunks: chunks.length };
}
