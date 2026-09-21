import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { askJDIHQuestion } from './services/jdihChat.js';
import { guardrailCheck, planUserIntent } from './services/reasoningEngine.js';
import { saveChatLog, getSessionHistory, saveHumanFeedback } from './services/chatLogService.js';
import { evaluateChatLogWithJudge } from './services/evaluatorService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

      return res.status(403).json({
        success: false,
        blocked: true,
        error: guardrail.reason,
        chatLogId: log.id,
      });
    }

    // 2. LAYER: REASONING ENGINE (Planner & Conditional Router)
    const plan = planUserIntent(message, clientApp);

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

      return res.json({
        success: true,
        sessionId,
        chatLogId: log.id,
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
      const result = await askJDIHQuestion(message);
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

      return res.json({
        success: true,
        sessionId,
        chatLogId: log.id,
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
    const { chat_log_id, rating, feedback } = req.body;
    if (!chat_log_id || !rating) {
      return res.status(400).json({ error: 'chat_log_id and rating are required.' });
    }

    const saved = await saveHumanFeedback({
      chatLogId: chat_log_id,
      rating,
      feedback,
    });

    return res.json({ success: true, message: 'Audit feedback recorded.', data: saved });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: Evaluation Layer (LLM-as-a-Judge)
 * Body: { "chat_log_id": 1 }
 */
app.post('/v1/eval/judge', async (req, res) => {
  try {
    const { chat_log_id } = req.body;
    if (!chat_log_id) {
      return res.status(400).json({ error: 'chat_log_id is required.' });
    }

    const evaluation = await evaluateChatLogWithJudge(chat_log_id);
    return res.json({ success: true, data: evaluation });
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
