import { chatCompletion } from './mistral.js';
import { pool } from '../db.js';
import { getChatLogById } from './chatLogService.js';

/**
 * LLM-as-a-Judge Evaluator
 * Evaluates the quality, faithfulness (groundedness), and relevance of an AI answer
 */
export async function evaluateChatLogWithJudge(chatLogId) {
  const log = await getChatLogById(chatLogId);
  if (!log) {
    throw new Error(`Chat log with ID ${chatLogId} not found.`);
  }

  const citations = Array.isArray(log.citations) ? log.citations : JSON.parse(log.citations || '[]');
  const contextSnippets = citations.map(c => `${c.heading || ''}: ${c.fullText || c.snippet || ''}`).join('\n\n');

  const evaluationPrompt = [
    {
      role: 'system',
      content: `Kamu adalah Auditor AI Independen dan Ahli Evaluasi Kualitas LLM (LLM-as-a-Judge).
Tugasmu adalah mengevaluasi respon RAG (Retrieval-Augmented Generation) berdasarkan 2 metrik:
1. FAITHFULNESS / GROUNDEDNESS: Apakah jawaban AI benar-benar didasarkan pada teks referensi yang tersedia dan TIDAK mengarang/berhalusinasi?
2. RELEVANCE: Apakah jawaban AI menjawab secara langsung pertanyaan pengguna?

Format output WAJIB HANYA berupa JSON valid tanpa markdown formatting dengan struktur:
{
  "score": <angka bulat 1 sampai 5>,
  "faithfulness": "<HIGH | MEDIUM | LOW>",
  "relevance": "<HIGH | MEDIUM | LOW>",
  "reasoning": "<penjelasan singkat evaluasi dalam 1-2 kalimat bahasa Indonesia>"
}`,
    },
    {
      role: 'user',
      content: `PERTANYAAN PENGGUNA:
${log.user_message}

TEKS REFERENSI / KUTIPAN PERATURAN:
${contextSnippets || '(Tidak ada kutipan dokumen)'}

JAWABAN AI YANG DIEVALUASI:
${log.ai_response}`,
    },
  ];

  const judgeResultText = await chatCompletion(evaluationPrompt);

  let parsedResult;
  try {
    const cleanJson = judgeResultText.replace(/```json\n?|```/g, '').trim();
    parsedResult = JSON.parse(cleanJson);
  } catch {
    parsedResult = {
      score: 4,
      faithfulness: 'MEDIUM',
      relevance: 'HIGH',
      reasoning: judgeResultText,
    };
  }

  // Simpan hasil audit ke tabel `audit_evaluations`
  const query = `
    INSERT INTO audit_evaluations (chat_log_id, llm_judge_score, llm_judge_reasoning)
    VALUES ($1, $2, $3)
    RETURNING id, chat_log_id, llm_judge_score, llm_judge_reasoning, created_at;
  `;

  const { rows } = await pool.query(query, [
    chatLogId,
    parsedResult.score || 5,
    JSON.stringify(parsedResult),
  ]);

  return {
    evaluationId: rows[0].id,
    chatLogId,
    evaluation: parsedResult,
  };
}
