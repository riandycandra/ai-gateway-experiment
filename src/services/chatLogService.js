import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.resolve('data');
const CHAT_LOGS_FILE = path.join(DATA_DIR, 'chat_logs.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_evaluations.json');

// Pastikan direktori data/ tersedia
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(filePath, defaultValue = []) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content || '[]');
    }
  } catch (err) {
    console.warn(`⚠️ Warning reading ${filePath}:`, err.message);
  }
  return defaultValue;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`❌ Error writing ${filePath}:`, err.message);
  }
}

/**
 * Save chat transaction for logging, observability, and audit
 */
export async function saveChatLog({
  sessionId,
  app,
  userId,
  userMessage,
  aiResponse,
  intent,
  citations = [],
  latencyMs = 0,
}) {
  const logs = readJsonFile(CHAT_LOGS_FILE, []);
  const newLog = {
    id: randomUUID(),
    session_id: sessionId,
    app: app || 'unknown',
    user_id: userId || 'anonymous',
    user_message: userMessage,
    ai_response: aiResponse,
    intent: intent || 'GENERAL',
    citations: citations,
    latency_ms: latencyMs,
    created_at: new Date().toISOString(),
  };

  logs.push(newLog);
  writeJsonFile(CHAT_LOGS_FILE, logs);

  return newLog;
}

/**
 * Retrieve recent conversation history for a given session
 */
export async function getSessionHistory(sessionId, limit = 6) {
  const logs = readJsonFile(CHAT_LOGS_FILE, []);
  const sessionLogs = logs
    .filter(log => log.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return sessionLogs.slice(-limit).map(l => ({
    user_message: l.user_message,
    ai_response: l.ai_response,
    created_at: l.created_at,
  }));
}

/**
 * Save human auditor feedback (thumbs_up, thumbs_down, comments)
 */
export async function saveHumanFeedback({ chatLogId, rating, feedback }) {
  const audits = readJsonFile(AUDIT_FILE, []);
  const auditEntry = {
    id: randomUUID(),
    chat_log_id: chatLogId,
    rating,
    human_feedback: feedback,
    created_at: new Date().toISOString(),
  };

  audits.push(auditEntry);
  writeJsonFile(AUDIT_FILE, audits);

  return auditEntry;
}

/**
 * Save LLM Judge evaluation result
 */
export async function saveJudgeEvaluation({ chatLogId, score, reasoning }) {
  const audits = readJsonFile(AUDIT_FILE, []);
  const auditEntry = {
    id: randomUUID(),
    chat_log_id: chatLogId,
    llm_judge_score: score,
    llm_judge_reasoning: reasoning,
    created_at: new Date().toISOString(),
  };

  audits.push(auditEntry);
  writeJsonFile(AUDIT_FILE, audits);

  return auditEntry;
}

/**
 * Get chat log details by ID
 */
export async function getChatLogById(chatLogId) {
  const logs = readJsonFile(CHAT_LOGS_FILE, []);
  return logs.find(log => log.id === chatLogId) || null;
}

/**
 * Get combined chat logs with evaluations for admin audit table
 */
export async function getAllChatLogsWithEvals(limit = 50) {
  const logs = readJsonFile(CHAT_LOGS_FILE, []);
  const audits = readJsonFile(AUDIT_FILE, []);

  const combined = logs.map(l => {
    const evalItem = audits.find(a => a.chat_log_id === l.id) || {};
    return {
      id: l.id,
      session_id: l.session_id,
      app: l.app,
      user_id: l.user_id,
      user_message: l.user_message,
      ai_response: l.ai_response,
      intent: l.intent,
      citations: l.citations,
      latency_ms: l.latency_ms,
      created_at: l.created_at,
      eval_id: evalItem.id || null,
      rating: evalItem.rating || null,
      human_feedback: evalItem.human_feedback || null,
      llm_judge_score: evalItem.llm_judge_score || null,
      llm_judge_reasoning: evalItem.llm_judge_reasoning || null,
    };
  });

  return combined.reverse().slice(0, limit);
}

/**
 * Get aggregated analytics stats for dashboard overview
 */
export async function getAnalyticsStats() {
  const logs = readJsonFile(CHAT_LOGS_FILE, []);
  const totalRuns = logs.length;
  const blockedRuns = logs.filter(l => l.intent === 'MALICIOUS_ATTEMPT').length;
  const successRuns = totalRuns - blockedRuns;
  const totalLatency = logs.reduce((acc, l) => acc + (l.latency_ms || 0), 0);
  const avgLatencyMs = totalRuns > 0 ? Math.round(totalLatency / totalRuns) : 0;
  const successRate = totalRuns > 0 ? ((successRuns / totalRuns) * 100).toFixed(1) : '100.0';

  return {
    totalRuns,
    avgLatencyMs,
    successRate: `${successRate}%`,
    blockedRuns,
  };
}

