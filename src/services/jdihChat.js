import { searchChunks, DEFAULT_COLLECTION } from './qdrant.js';
import { generateEmbeddings, chatCompletion, chatCompletionStream } from './mistral.js';

/**
 * Service untuk menjawab pertanyaan JDIH menggunakan RAG (Retrieval-Augmented Generation)
 * 1. Pertanyaan user di-embed jadi vektor via Mistral
 * 2. Cari top-K potongan pasal terdekat di Qdrant Cloud via Cosine Similarity
 * 3. Kirim potongan pasal + pertanyaan ke LLM Mistral
 * 4. Record hierarchical spans ke Langfuse jika parentTrace disediakan
 */
export async function askJDIHQuestion(userQuestion, limit = 4, chatHistory = [], parentTrace = null) {
  // 1. Span Retrieval di Langfuse
  const retrievalSpan = parentTrace && typeof parentTrace.span === 'function'
    ? parentTrace.span({
        name: 'vector-retrieval-qdrant-cloud',
        input: { query: userQuestion, limit },
        metadata: { collection: DEFAULT_COLLECTION, indexType: 'hnsw_cosine' },
      })
    : null;

  // Generate embedding untuk pertanyaan user
  const [questionVector] = await generateEmbeddings([userQuestion]);

  // 2. Query ke Qdrant Cloud menggunakan Cosine Similarity
  let relevantChunks = [];
  try {
    relevantChunks = await searchChunks(DEFAULT_COLLECTION, questionVector, limit);
  } catch (err) {
    console.error('⚠️ Qdrant search error:', err.message);
  }

  const citations = relevantChunks.map(c => ({
    documentTitle: c.documentTitle,
    documentNumber: c.documentNumber,
    heading: c.heading,
    similarityScore: parseFloat(c.score).toFixed(4),
    snippet: c.text.slice(0, 150) + '...',
    fullText: c.text,
    pageNumber: c.pageNumber,
  }));

  if (retrievalSpan) {
    retrievalSpan.end({
      output: {
        retrievedCount: relevantChunks.length,
        citations: citations.map(c => ({
          documentTitle: c.documentTitle,
          heading: c.heading,
          similarityScore: c.similarityScore,
        })),
      },
    });
  }

  if (relevantChunks.length === 0) {
    return {
      answer: "Maaf, belum ada dokumen peraturan yang tersimpan di dalam basis pengetahuan JDIH Qdrant Cloud.",
      citations: [],
    };
  }

  const contextText = relevantChunks
    .map((chunk, idx) => `[Dokumen ${idx + 1}: ${chunk.documentTitle} (${chunk.documentNumber || 'N/A'}) - Hal ${chunk.pageNumber} - ${chunk.heading}]\n${chunk.text}`)
    .join('\n\n---\n\n');

  // Format multi-turn messages
  const messages = buildMessagesPayload(contextText, userQuestion, chatHistory);

  // 3. Generation Span di Langfuse
  const generation = parentTrace && typeof parentTrace.generation === 'function'
    ? parentTrace.generation({
        name: 'mistral-rag-synthesis',
        model: 'mistral-small-latest',
        input: messages,
      })
    : null;

  // 5. Generate jawaban menggunakan Mistral
  const answer = await chatCompletion(messages);

  if (generation) {
    generation.end({
      output: answer,
    });
  }

  return {
    answer,
    citations,
  };
}

/**
 * Streaming version of askJDIHQuestion with Multi-Turn Memory and Langfuse Tracing
 */
export async function askJDIHQuestionStream(userQuestion, limit = 4, chatHistory = [], parentTrace = null) {
  const retrievalSpan = parentTrace && typeof parentTrace.span === 'function'
    ? parentTrace.span({
        name: 'vector-retrieval-qdrant-cloud-stream',
        input: { query: userQuestion, limit },
        metadata: { collection: DEFAULT_COLLECTION, indexType: 'hnsw_cosine' },
      })
    : null;

  const [questionVector] = await generateEmbeddings([userQuestion]);

  let relevantChunks = [];
  try {
    relevantChunks = await searchChunks(DEFAULT_COLLECTION, questionVector, limit);
  } catch (err) {
    console.error('⚠️ Qdrant search stream error:', err.message);
  }

  const citations = relevantChunks.map(c => ({
    documentTitle: c.documentTitle,
    documentNumber: c.documentNumber,
    heading: c.heading,
    similarityScore: parseFloat(c.score).toFixed(4),
    snippet: c.text.slice(0, 150) + '...',
    fullText: c.text,
    pageNumber: c.pageNumber,
  }));

  if (retrievalSpan) {
    retrievalSpan.end({
      output: {
        retrievedCount: relevantChunks.length,
        citations: citations.map(c => ({
          documentTitle: c.documentTitle,
          heading: c.heading,
          similarityScore: c.similarityScore,
        })),
      },
    });
  }

  const contextText = relevantChunks
    .map((chunk, idx) => `[Dokumen ${idx + 1}: ${chunk.documentTitle} (${chunk.documentNumber || 'N/A'}) - Hal ${chunk.pageNumber} - ${chunk.heading}]\n${chunk.text}`)
    .join('\n\n---\n\n');

  // Format multi-turn messages
  const messages = buildMessagesPayload(contextText, userQuestion, chatHistory);

  const generation = parentTrace && typeof parentTrace.generation === 'function'
    ? parentTrace.generation({
        name: 'mistral-rag-stream-synthesis',
        model: 'mistral-small-latest',
        input: messages,
      })
    : null;

  const stream = chatCompletionStream(messages);

  return {
    citations,
    stream,
    generation,
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
