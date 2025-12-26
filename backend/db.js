// PostgreSQL connection using pg
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://kujto_ai_user:a4bKvzw3xuWhc90Yq512GVAvieYfGOTq@dpg-d52ocmffte5s73db8bj0-a/kujto_ai',
  ssl: { rejectUnauthorized: false }
});

export default pool;
