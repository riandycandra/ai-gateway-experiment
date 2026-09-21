import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'ai_user',
  password: process.env.PG_PASSWORD || 'ai_password',
  database: process.env.PG_DATABASE || 'ai_gateway',
});
