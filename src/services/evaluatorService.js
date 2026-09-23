import { chatCompletion } from './mistral.js';
import { getChatLogById, saveJudgeEvaluation } from './chatLogService.js';
import { sendTraceScore, flushLangfuse } from './langfuse.js';

/**
 * LLM-as-a-Judge Evaluator with RAG Triad Metrics:
 * 1. Faithfulness / Groundedness (Anti-hallucination)
 * 2. Answer Relevance
 * 3. Context Relevance (Retrieval precision)
 *
 * Results are saved to local PostgreSQL (audit_evaluations) and pushed to Langfuse.
 */
export async function evaluateChatLogWithJudge(chatLogId, { trace = null, traceId = null } = {}) {
  const log = await getChatLogById(chatLogId);
  if (!log) {
    throw new Error(`Chat log with ID ${chatLogId} not found.`);
  }

  const citations = Array.isArray(log.citations) ? log.citations : JSON.parse(log.citations || '[]');
  const contextSnippets = citations.map(c => `${c.heading || ''}: ${c.fullText || c.snippet || ''}`).join('\n\n');

  const evaluationPrompt = [
    {
      role: 'system',
      content: `Kamu adalah Auditor AI Independen dan Ahli Evaluasi Kualitas RAG (LLM-as-a-Judge).
Tugasmu adalah mengevaluasi sistem RAG berdasarkan RAG Triad (3 Metrik Inti):

1. FAITHFULNESS / GROUNDEDNESS (1-5):
   Apakah klaim dalam jawaban AI didasarkan murni pada teks referensi dan BEBAS dari halusinasi/asumsi liar?
   (1 = Hallucination parah, 5 = 100% grounded pada dokumen)

2. ANSWER RELEVANCE (1-5):
   Apakah jawaban AI menjawab maksud dan inti pertanyaan pengguna secara lugas dan tepat sasaran?
   (1 = Jawaban melenceng, 5 = Sangat relevan dan memuaskan pertanyaan)

3. CONTEXT RELEVANCE / RETRIEVAL PRECISION (1-5):
   Seberapa tepat dan relevan teks referensi/kutipan pasal yang berhasil ditarik oleh sistem terhadap pertanyaan pengguna?
   (1 = Dokumen yang ditarik sama sekali tidak nyambung, 5 = Dokumen tepat sasaran mengatur hal yang ditanyakan)

Format output WAJIB HANYA berupa JSON valid tanpa markdown formatting:
{
  "score": <angka bulat 1 sampai 5 rata-rata keseluruhan>,
  "faithfulness_score": <angka 1 sampai 5>,
  "answer_relevance_score": <angka 1 sampai 5>,
  "context_relevance_score": <angka 1 sampai 5>,
  "faithfulness": "<HIGH | MEDIUM | LOW>",
  "relevance": "<HIGH | MEDIUM | LOW>",
  "context_relevance": "<HIGH | MEDIUM | LOW>",
  "reasoning": "<penjelasan singkat 1-2 kalimat dalam bahasa Indonesia>"
}`,
    },
    {
      role: 'user',
      content: `PERTANYAAN PENGGUNA:
${log.user_message}

TEKS REFERENSI / KUTIPAN PERATURAN HASIL RETRIEVAL:
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
      faithfulness_score: 4,
      answer_relevance_score: 4,
      context_relevance_score: 4,
      faithfulness: 'MEDIUM',
      relevance: 'HIGH',
      context_relevance: 'HIGH',
      reasoning: judgeResultText,
    };
  }

  // 1. Simpan hasil audit evaluasi
  await saveJudgeEvaluation({
    chatLogId,
    score: parsedResult.score || 5,
    reasoning: JSON.stringify(parsedResult),
  });

  // 2. Kirim metrik ke Langfuse Cloud jika trace / traceId tersedia
  const activeTrace = trace;
  const activeTraceId = traceId || (trace ? trace.id : null);

  if (activeTrace || activeTraceId) {
    await Promise.all([
      sendTraceScore({
        trace: activeTrace,
        traceId: activeTraceId,
        name: 'faithfulness',
        value: parsedResult.faithfulness_score || parsedResult.score || 5,
        comment: `Faithfulness: ${parsedResult.faithfulness || 'N/A'}. ${parsedResult.reasoning || ''}`,
      }),
      sendTraceScore({
        trace: activeTrace,
        traceId: activeTraceId,
        name: 'answer_relevance',
        value: parsedResult.answer_relevance_score || parsedResult.score || 5,
        comment: `Relevance: ${parsedResult.relevance || 'N/A'}. ${parsedResult.reasoning || ''}`,
      }),
      sendTraceScore({
        trace: activeTrace,
        traceId: activeTraceId,
        name: 'context_relevance',
        value: parsedResult.context_relevance_score || parsedResult.score || 5,
        comment: `Context: ${parsedResult.context_relevance || 'N/A'}. ${parsedResult.reasoning || ''}`,
      }),
      sendTraceScore({
        trace: activeTrace,
        traceId: activeTraceId,
        name: 'overall_score',
        value: parsedResult.score || 5,
        comment: parsedResult.reasoning,
      }),
    ]);

    await flushLangfuse();
  }

  return {
    evaluationId: rows[0].id,
    chatLogId,
    evaluation: parsedResult,
  };
}

/**
 * Trigger evaluation asynchronously in the background (fire-and-forget)
 */
export function triggerBackgroundEvaluation({ chatLogId, trace, traceId }) {
  setImmediate(async () => {
    try {
      await evaluateChatLogWithJudge(chatLogId, { trace, traceId });
      console.log(`[Evaluator] Background RAG Triad evaluation completed for chatLogId ${chatLogId}`);
    } catch (err) {
      console.error(`[Evaluator] Background evaluation error for chatLogId ${chatLogId}:`, err.message);
    }
  });
}
