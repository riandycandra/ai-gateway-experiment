import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { askJDIHQuestion, askJDIHQuestionStream } from './services/jdihChat.js';
import { guardrailCheck, planUserIntent } from './services/reasoningEngine.js';
import { saveChatLog, getSessionHistory, saveHumanFeedback } from './services/chatLogService.js';
import { evaluateChatLogWithJudge, triggerBackgroundEvaluation } from './services/evaluatorService.js';
import { createChatTrace, sendTraceScore, flushLangfuse, isLangfuseEnabled } from './services/langfuse.js';

import { pool } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-gateway' });
});

/**
 * Universal Chat Endpoint with Reasoning Engine & Observability Logging
 * Body:
 * {
 *   "app": "jdih",
 *   "message": "Apa sanksi jika karyawan terlambat masuk kerja?",
 *   "session_id": "sess-1234" (opsional, auto-generated jika kosong),
 *   "user_id": "EMP-001" (opsional)
 * }
 */
app.post('/v1/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { app: clientApp, message, session_id, user_id } = req.body;
    const sessionId = session_id || `sess_${Date.now()}`;

    if (!message) {
      return res.status(400).json({ error: 'Field "message" is required.' });
    }

    // 0. Inisialisasi Root Trace Langfuse
    const trace = createChatTrace({
      sessionId,
      userId: user_id,
      app: clientApp,
      message,
    });

    // 1. LAYER: GUARDRAIL & STRESS TEST CHECK
    const guardrail = guardrailCheck(message);
    if (!guardrail.isSafe) {
      const latencyMs = Date.now() - startTime;
      const log = await saveChatLog({
        sessionId,
        app: clientApp || 'unknown',
        userId: user_id,
        userMessage: message,
        aiResponse: guardrail.reason,
        intent: 'MALICIOUS_ATTEMPT',
        latencyMs,
      });

      trace.update({
        output: { blocked: true, error: guardrail.reason },
        tags: ['blocked', 'guardrail_violation'],
      });
      await flushLangfuse();

      return res.status(403).json({
        success: false,
        blocked: true,
        error: guardrail.reason,
        chatLogId: log.id,
        traceId: trace.id,
      });
    }

    // 2. LAYER: REASONING ENGINE (Planner & Conditional Router)
    const routerSpan = trace.span({
      name: 'reasoning-router-planner',
      input: { message, app: clientApp },
    });
    const plan = planUserIntent(message, clientApp);
    routerSpan.end({
      output: { intent: plan.intent, action: plan.action },
    });

    // Fast-path: Sapaan atau chit-chat langsung dibalas tanpa buang token RAG/DB
    if (plan.action === 'DIRECT_REPLY') {
      const latencyMs = Date.now() - startTime;
      const log = await saveChatLog({
        sessionId,
        app: clientApp || 'general',
        userId: user_id,
        userMessage: message,
        aiResponse: plan.directResponse,
        intent: plan.intent,
        latencyMs,
      });

      trace.update({
        output: { answer: plan.directResponse },
      });
      await flushLangfuse();

      return res.json({
        success: true,
        sessionId,
        chatLogId: log.id,
        traceId: trace.id,
        app: clientApp,
        intent: plan.intent,
        latencyMs,
        data: {
          answer: plan.directResponse,
          citations: [],
        },
      });
    }

    // 3. LAYER: RETRIEVAL & GENERATION (JDIH / HC)
    if (clientApp === 'jdih') {
      const chatHistory = await getSessionHistory(sessionId, 6);
      const result = await askJDIHQuestion(message, 4, chatHistory, trace);
      const latencyMs = Date.now() - startTime;

      // 4. LAYER: RECORD PERSISTENCE & AUDIT LOGGING
      const log = await saveChatLog({
        sessionId,
        app: 'jdih',
        userId: user_id,
        userMessage: message,
        aiResponse: result.answer,
        intent: plan.intent,
        citations: result.citations,
        latencyMs,
      });

      trace.update({
        output: {
          answer: result.answer,
          citationsCount: result.citations.length,
        },
      });

      // 5. Trigger Background RAG Triad Evaluator (fire-and-forget)
      triggerBackgroundEvaluation({ chatLogId: log.id, trace, traceId: trace.id });

      return res.json({
        success: true,
        sessionId,
        chatLogId: log.id,
        traceId: trace.id,
        app: 'jdih',
        intent: plan.intent,
        latencyMs,
        data: result,
      });
    }

    if (clientApp === 'hc') {
      return res.status(501).json({
        success: false,
        message: 'Aplikasi HC sedang dalam pengembangan tahap berikutnya.',
      });
    }

    return res.status(400).json({
      error: `Unknown app "${clientApp}". Supported apps: "jdih", "hc".`,
    });
  } catch (error) {
    console.error('Error handling chat request:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

/**
 * Streaming Chat Endpoint (Server-Sent Events / SSE)
 */
app.post('/v1/chat/stream', async (req, res) => {
  const startTime = Date.now();
  try {
    const { app: clientApp, message, session_id, user_id } = req.body;
    const sessionId = session_id || `sess_${Date.now()}`;

    if (!message) {
      return res.status(400).json({ error: 'Field "message" is required.' });
    }

    const trace = createChatTrace({
      sessionId,
      userId: user_id,
      app: clientApp,
      message,
      tags: ['streaming'],
    });

    // 1. Guardrail Check
    const guardrail = guardrailCheck(message);
    if (!guardrail.isSafe) {
      await saveChatLog({
        sessionId,
        app: clientApp || 'unknown',
        userId: user_id,
        userMessage: message,
        aiResponse: guardrail.reason,
        intent: 'MALICIOUS_ATTEMPT',
        latencyMs: Date.now() - startTime,
      });

      trace.update({
        output: { blocked: true, error: guardrail.reason },
        tags: ['blocked', 'guardrail_violation'],
      });
      await flushLangfuse();

      return res.status(403).json({
        success: false,
        blocked: true,
        error: guardrail.reason,
      });
    }

    // 2. Reasoning Engine
    const routerSpan = trace.span({
      name: 'reasoning-router-planner',
      input: { message, app: clientApp },
    });
    const plan = planUserIntent(message, clientApp);
    routerSpan.end({
      output: { intent: plan.intent, action: plan.action },
    });

    // Fast-path: Sapaan (langsung kirim via SSE dan selesai)
    if (plan.action === 'DIRECT_REPLY') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      res.write(`data: ${JSON.stringify({ type: 'meta', intent: plan.intent, citations: [] })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'token', token: plan.directResponse })}\n\n`);

      const log = await saveChatLog({
        sessionId,
        app: clientApp || 'general',
        userId: user_id,
        userMessage: message,
        aiResponse: plan.directResponse,
        intent: plan.intent,
        latencyMs: Date.now() - startTime,
      });

      trace.update({
        output: { answer: plan.directResponse },
      });
      await flushLangfuse();

      res.write(`data: ${JSON.stringify({ type: 'done', chatLogId: log.id, latencyMs: log.latency_ms })}\n\n`);
      return res.end();
    }

    if (clientApp !== 'jdih') {
      return res.status(400).json({ error: 'Streaming only supported for "jdih" at this stage.' });
    }

    // 3. Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chatHistory = await getSessionHistory(sessionId, 6);
    const { citations, stream, generation } = await askJDIHQuestionStream(message, 4, chatHistory, trace);

    // Kirim event meta (citations & intent) terlebih dahulu
    res.write(`data: ${JSON.stringify({ type: 'meta', intent: plan.intent, citations })}\n\n`);

    let fullAnswer = '';
    for await (const token of stream) {
      fullAnswer += token;
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    }

    if (generation) {
      generation.end({ output: fullAnswer });
    }

    // 4. Save to chat_logs after streaming finishes
    const latencyMs = Date.now() - startTime;
    const log = await saveChatLog({
      sessionId,
      app: 'jdih',
      userId: user_id,
      userMessage: message,
      aiResponse: fullAnswer,
      intent: plan.intent,
      citations,
      latencyMs,
    });

    trace.update({
      output: { answer: fullAnswer, citationsCount: citations.length },
    });

    // Trigger Background RAG Triad Evaluator
    triggerBackgroundEvaluation({ chatLogId: log.id, trace, traceId: trace.id });

    res.write(`data: ${JSON.stringify({ type: 'done', chatLogId: log.id, latencyMs })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * Endpoint: Get Conversation History by Session ID
 */
app.get('/v1/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await getSessionHistory(sessionId);
    return res.json({ success: true, sessionId, history });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: Human Validation & Auditor Feedback Loop
 * Body: { "chat_log_id": 1, "rating": "thumbs_up" | "thumbs_down", "feedback": "Catatan koreksi" }
 */
app.post('/v1/audit/feedback', async (req, res) => {
  try {
    const { chat_log_id, rating, feedback, trace_id } = req.body;
    if (!chat_log_id || !rating) {
      return res.status(400).json({ error: 'chat_log_id and rating are required.' });
    }

    const saved = await saveHumanFeedback({
      chatLogId: chat_log_id,
      rating,
      feedback,
    });

    // Kirim human feedback score ke Langfuse jika trace_id tersedia
    if (trace_id) {
      const scoreValue = rating === 'thumbs_up' ? 1 : (rating === 'thumbs_down' ? 0 : 0.5);
      await sendTraceScore({
        traceId: trace_id,
        name: 'user_feedback',
        value: scoreValue,
        comment: feedback || `Human rating: ${rating}`,
        dataType: 'CATEGORICAL',
      });
      await flushLangfuse();
    }

    return res.json({ success: true, message: 'Audit feedback recorded.', data: saved });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: Evaluation Layer (LLM-as-a-Judge)
 * Body: { "chat_log_id": 1, "trace_id": "optional-trace-id" }
 */
app.post('/v1/eval/judge', async (req, res) => {
  try {
    const { chat_log_id, trace_id } = req.body;
    if (!chat_log_id) {
      return res.status(400).json({ error: 'chat_log_id is required.' });
    }

    const evaluation = await evaluateChatLogWithJudge(chat_log_id, { traceId: trace_id });
    return res.json({ success: true, data: evaluation });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: Get all chat logs with evaluations (for Runs page)
 */
app.get('/v1/chat/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const query = `
      SELECT 
        l.id,
        l.session_id,
        l.app,
        l.user_id,
        l.user_message,
        l.ai_response,
        l.intent,
        l.citations,
        l.latency_ms,
        l.created_at,
        e.id as eval_id,
        e.rating,
        e.human_feedback,
        e.llm_judge_score,
        e.llm_judge_reasoning
      FROM chat_logs l
      LEFT JOIN audit_evaluations e ON e.chat_log_id = l.id
      ORDER BY l.created_at DESC
      LIMIT $1;
    `;
    const { rows } = await pool.query(query, [limit]);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: Get aggregated analytics stats (for Overview page)
 */
app.get('/v1/analytics/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*)::int as total_runs,
        COALESCE(ROUND(AVG(latency_ms)), 0)::int as avg_latency_ms,
        COUNT(CASE WHEN intent != 'MALICIOUS_ATTEMPT' THEN 1 END)::int as success_runs,
        COUNT(CASE WHEN intent = 'MALICIOUS_ATTEMPT' THEN 1 END)::int as blocked_runs
      FROM chat_logs;
    `;
    const { rows } = await pool.query(statsQuery);
    const stats = rows[0];

    const total = stats.total_runs || 0;
    const successRate = total > 0 ? ((stats.success_runs / total) * 100).toFixed(1) : '100.0';

    return res.json({
      success: true,
      data: {
        totalRuns: stats.total_runs,
        avgLatencyMs: stats.avg_latency_ms,
        successRate: `${successRate}%`,
        blockedRuns: stats.blocked_runs,
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 AI Gateway Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use! Please kill the process using port ${PORT} or change PORT in .env`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});
