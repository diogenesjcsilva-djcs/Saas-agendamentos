import pg from 'pg';
import dotenv from 'dotenv';

import fs from 'fs';
import path from 'path';

// Load .env first, then override with .env.local if it exists
dotenv.config();
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  try {
    const envLocal = dotenv.parse(fs.readFileSync(envLocalPath));
    for (const k in envLocal) {
      process.env[k] = envLocal[k];
    }
  } catch (e) {
    console.error("Error loading .env.local:", e);
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("CRITICAL: DATABASE_URL environment variable is missing!");
}

export const pool = new pg.Pool({
  connectionString: connectionString || undefined,
  ssl: {
    rejectUnauthorized: false // Neon requires SSL
  }
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is missing in the serverless environment!");
  }
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('Executed query:', { text, duration, rows: res.rowCount });
  }
  return res.rows;
}
