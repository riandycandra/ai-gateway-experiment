import { pool } from '../db.js';

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
  const query = `
    INSERT INTO chat_logs (
      session_id, app, user_id, user_message, ai_response, intent, citations, latency_ms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, created_at;
  `;

  const values = [
    sessionId,
    app,
    userId || 'anonymous',
    userMessage,
    aiResponse,
    intent || 'GENERAL',
    JSON.stringify(citations),
    latencyMs,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

/**
 * Retrieve recent conversation history for a given session
 */
export async function getSessionHistory(sessionId, limit = 6) {
  const query = `
    SELECT user_message, ai_response, created_at
    FROM chat_logs
    WHERE session_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
  `;

  const { rows } = await pool.query(query, [sessionId, limit]);
  // Return in chronological order
  return rows.reverse();
}

/**
 * Save human auditor feedback (thumbs_up, thumbs_down, comments)
 */
export async function saveHumanFeedback({ chatLogId, rating, feedback }) {
  const query = `
    INSERT INTO audit_evaluations (chat_log_id, rating, human_feedback)
    VALUES ($1, $2, $3)
    RETURNING id, chat_log_id, rating, human_feedback, created_at;
  `;

  const { rows } = await pool.query(query, [chatLogId, rating, feedback]);
  return rows[0];
}

/**
 * Get chat log details by ID
 */
export async function getChatLogById(chatLogId) {
  const query = `
    SELECT * FROM chat_logs WHERE id = $1;
  `;
  const { rows } = await pool.query(query, [chatLogId]);
  return rows[0] || null;
}
