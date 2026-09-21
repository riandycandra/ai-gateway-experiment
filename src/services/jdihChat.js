import { pool } from '../db.js';
import { generateEmbeddings, chatCompletion, chatCompletionStream } from './mistral.js';

/**
 * Service untuk menjawab pertanyaan JDIH menggunakan RAG (Retrieval-Augmented Generation)
 * 1. Pertanyaan user di-embed jadi vektor
 * 2. Cari top-K potongan pasal terdekat di PostgreSQL via cosine distance (<=>)
 * 3. Kirim potongan pasal + pertanyaan ke LLM Mistral
 */
export async function askJDIHQuestion(userQuestion, limit = 4, chatHistory = []) {
  // 1. Generate embedding untuk pertanyaan user
  const [questionVector] = await generateEmbeddings([userQuestion]);
  const vectorStr = JSON.stringify(questionVector);

  // 2. Query ke PostgreSQL menggunakan cosine similarity operator (<=>)
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

  if (relevantChunks.length === 0) {
    return {
      answer: "Maaf, belum ada dokumen peraturan yang tersimpan di dalam basis pengetahuan JDIH.",
      citations: [],
    };
  }

  const contextText = relevantChunks
    .map((chunk, idx) => `[Dokumen ${idx + 1}: ${chunk.document_title} (${chunk.document_number || 'N/A'}) - ${chunk.heading}]\n${chunk.chunk_text}`)
    .join('\n\n---\n\n');

  // Format multi-turn messages
  const messages = buildMessagesPayload(contextText, userQuestion, chatHistory);

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

/**
 * Streaming version of askJDIHQuestion with Multi-Turn Memory
 */
export async function askJDIHQuestionStream(userQuestion, limit = 4, chatHistory = []) {
  const [questionVector] = await generateEmbeddings([userQuestion]);
  const vectorStr = JSON.stringify(questionVector);

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

  const citations = relevantChunks.map(c => ({
    documentTitle: c.document_title,
    documentNumber: c.document_number,
    heading: c.heading,
    similarityScore: parseFloat(c.similarity).toFixed(4),
    snippet: c.chunk_text.slice(0, 150) + '...',
    fullText: c.chunk_text,
  }));

  const contextText = relevantChunks
    .map((chunk, idx) => `[Dokumen ${idx + 1}: ${chunk.document_title} (${chunk.document_number || 'N/A'}) - ${chunk.heading}]\n${chunk.chunk_text}`)
    .join('\n\n---\n\n');

  // Format multi-turn messages
  const messages = buildMessagesPayload(contextText, userQuestion, chatHistory);
  const stream = chatCompletionStream(messages);

  return {
    citations,
    stream,
  };
}

/**
 * Helper to construct messages payload with System Prompt, Conversation History, and Current Question
 */
function buildMessagesPayload(contextText, userQuestion, chatHistory = []) {
  const messages = [
    {
      role: 'system',
      content: `Kamu adalah Asisten AI Resmi JDIH (Jaringan Dokumentasi dan Informasi Hukum) Perusahaan.
Tugasmu adalah menjawab pertanyaan pengguna HANYA berdasarkan referensi peraturan dan ketentuan hukum perusahaan yang diberikan di bawah ini.

Prinsip & Disiplin Menjawab (WAJIB DIPATUHI):
1. LANDASAN HUKUM LITERAL (Strict Grounding):
   - Jawab HANYA berdasarkan fakta dan klausa yang tertulis secara eksplisit dalam teks referensi.
   - Selalu sebutkan nama dokumen, nomor keputusan, bab, dan pasal yang menjadi dasar jawabanmu.
2. LARANGAN EKSTRAPOLASI & PERHITUNGAN ASUMSIF (Zero Math Hallucination):
   - DILARANG mengarang rumus matematika, mengalikan, atau menjumlahkan angka (seperti masa kerja, denda, atau jatah hak) kecuali jika formula perhitungan tersebut TERTULIS SECARA EKSPLISIT di dalam pasal.
   - Jika suatu hak atau kewajiban memiliki batas masa berlaku / ketentuan hangus (expiration) atau syarat periodik (per tahun berjalan), jangan berasumsi bahwa nilai tersebut dapat diakumulasikan.
3. KONSISTENSI & PENALARAN PERCAKAPAN:
   - Kamu mengingat konteks riwayat percakapan sebelumnya dalam sesi ini.
   - Jika pengguna menegur, mengoreksi, atau menanyakan alasan pernyataanmu sebelumnya, akui dengan jujur dan sopan apabila jawaban sebelumnya mengandung asumsi/ekstrapolasi yang tidak berdasar pada dokumen, lalu luruskan kembali jawabanmu murni sesuai teks dokumen.
4. BATASAN PENGETAHUAN (Honest Boundary):
   - Jika suatu hal atau rincian spesifik TIDAK tertulis dalam teks referensi yang tersedia, nyatakan dengan jujur dan lugas bahwa peraturan perusahaan yang tersedia saat ini tidak mengatur hal tersebut. JANGAN membuat asumsi atau spekulasi.

Berikut adalah teks referensi peraturan yang relevan:
====================
${contextText}
====================`,
    },
  ];

  // Sisipkan riwayat percakapan sebelumnya (Multi-Turn)
  if (Array.isArray(chatHistory)) {
    for (const turn of chatHistory) {
      if (turn.user_message) {
        messages.push({ role: 'user', content: turn.user_message });
      }
      if (turn.ai_response) {
        messages.push({ role: 'assistant', content: turn.ai_response });
      }
    }
  }

  // Pertanyaan pengguna saat ini
  messages.push({
    role: 'user',
    content: userQuestion,
  });

  return messages;
}
