import { pool } from '../db.js';

async function initDb() {
  console.log('🔄 Initializing database with pgvector extension...');
  const client = await pool.connect();
  try {
    // 1. Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ Extension "vector" enabled.');

    // 2. Create Documents metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS jdih_documents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        document_number VARCHAR(100),
        category VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "jdih_documents" ready.');

    // 3. Create Document Chunks & Vector Store table
    // Mistral 'mistral-embed' produces 1024-dimensional vectors
    await client.query(`
      CREATE TABLE IF NOT EXISTS jdih_chunks (
        id SERIAL PRIMARY KEY,
        document_id INT REFERENCES jdih_documents(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        heading TEXT,
        page_number INT,
        embedding vector(1024),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "jdih_chunks" ready.');

    // 4. Create HNSW index for fast approximate nearest neighbor (ANN) search
    await client.query(`
      CREATE INDEX IF NOT EXISTS jdih_chunks_embedding_hnsw_idx 
      ON jdih_chunks USING hnsw (embedding vector_cosine_ops);
    `);
    console.log('✅ HNSW index created for cosine similarity.');

    console.log('🎉 Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
