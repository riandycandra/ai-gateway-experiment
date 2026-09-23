/**
 * Database module: PostgreSQL has been deprecated.
 * Vector storage and retrieval has been fully migrated to Qdrant Cloud (src/services/qdrant.js).
 * Chat logs are persisted locally in data/chat_logs.json (src/services/chatLogService.js).
 */

export const pool = {
  query: async () => {
    console.warn('⚠️ Warning: PostgreSQL pool.query called, but PostgreSQL is deprecated. Vector search is now handled by Qdrant Cloud.');
    return { rows: [] };
  },
  end: async () => {},
};

export default pool;
