/**
 * API Client for AI Gateway Backend
 */
export const api = {
  // Fetch real chat logs with audit evaluations
  async getChatLogs(limit = 50) {
    const res = await fetch(`/v1/chat/logs?limit=${limit}`);
    return await res.json();
  },

  // Fetch aggregated analytics metrics
  async getAnalyticsStats() {
    const res = await fetch('/v1/analytics/stats');
    return await res.json();
  },

  // Send question to chat gateway
  async sendChat({ app, message, userId, sessionId }) {
    const res = await fetch('/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, message, user_id: userId, session_id: sessionId }),
    });
    return await res.json();
  },

  // Submit human auditor feedback
  async submitHumanFeedback({ chatLogId, rating, feedback }) {
    const res = await fetch('/v1/audit/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_log_id: chatLogId, rating, feedback }),
    });
    return await res.json();
  },

  // Trigger LLM-as-a-Judge evaluation
  async triggerLLMJudge(chatLogId) {
    const res = await fetch('/v1/eval/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_log_id: chatLogId }),
    });
    return await res.json();
  },
};
