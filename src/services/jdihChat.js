import { pool } from '../db.js';
import { generateEmbeddings, chatCompletion } from './mistral.js';

/**
 * Service untuk menjawab pertanyaan JDIH menggunakan RAG (Retrieval-Augmented Generation)
 * 1. Pertanyaan user di-embed jadi vektor
 * 2. Cari top-K potongan pasal terdekat di PostgreSQL via cosine distance (<=>)
 * 3. Kirim potongan pasal + pertanyaan ke LLM Mistral
 */
export async function askJDIHQuestion(userQuestion, limit = 4) {
  // 1. Generate embedding untuk pertanyaan user
  const [questionVector] = await generateEmbeddings([userQuestion]);
  const vectorStr = JSON.stringify(questionVector);

  // 2. Query ke PostgreSQL menggunakan cosine similarity operator (<=>)
  // 1 - (embedding <=> questionVector) adalah cosine similarity (semakin mendekati 1 semakin mirip)
  const searchQuery = `
    SELECT 
      c.id,
      c.heading,
      c.chunk_text,
      d.title as document_title,
      d.document_number,
      1 - (c.embedding <=> $1::vector) as similarity
    FROM jdih_chunks c
    JOIN jdih_documents d ON c.document_id = d.id
    ORDER BY c.embedding <=> $1::vector ASC
    LIMIT $2;
  `;

  const { rows: relevantChunks } = await pool.query(searchQuery, [vectorStr, limit]);

  console.log(relevantChunks);

  if (relevantChunks.length === 0) {
    return {
      answer: "Maaf, belum ada dokumen peraturan yang tersimpan di dalam basis pengetahuan JDIH.",
      citations: [],
    };
  }

  // 3. Susun Konteks Referensi dari potongan pasal yang ditemukan
  const contextText = relevantChunks
    .map((chunk, idx) => {
      return `[Dokumen ${idx + 1}: ${chunk.document_title} (${chunk.document_number || 'N/A'}) - ${chunk.heading}]\n${chunk.chunk_text}`;
    })
    .join('\n\n---\n\n');

  console.log(contextText);

  // 4. Susun System Prompt & User Message untuk LLM
  const messages = [
    {
      role: 'system',
      content: `Kamu adalah Asisten AI Resmi JDIH (Jaringan Dokumentasi dan Informasi Hukum) Perusahaan.
Tugasmu adalah menjawab pertanyaan pengguna HANYA berdasarkan referensi peraturan dan ketentuan hukum perusahaan yang diberikan di bawah ini.

Petunjuk Penting:
1. Bersikaplah profesional, jelas, dan lugas.
2. Selalu sebutkan dasar hukum, bab, pasal, atau nomor dokumen yang menjadi dasar jawabanmu (contoh: "Berdasarkan Pasal 15 Peraturan Perusahaan No. 01/2024...").
3. Jika jawaban tidak ditemukan di dalam teks referensi, katakan dengan jujur bahwa informasi tersebut tidak tercantum dalam dokumen peraturan yang tersedia saat ini, jangan mengarang atau berhalusinasi.

Berikut adalah teks referensi peraturan yang relevan:
====================
${contextText}
====================`,
    },
    {
      role: 'user',
      content: userQuestion,
    },
  ];

  // 5. Generate jawaban menggunakan Mistral
  const answer = await chatCompletion(messages);

  return {
    answer,
    citations: relevantChunks.map(c => ({
      documentTitle: c.document_title,
      documentNumber: c.document_number,
      heading: c.heading,
      similarityScore: parseFloat(c.similarity).toFixed(4),
      snippet: c.chunk_text.slice(0, 150) + '...',
      fullText: c.chunk_text,
    })),
  };
}
