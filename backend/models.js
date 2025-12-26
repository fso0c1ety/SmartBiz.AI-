import pool from './db.js';

export async function saveChatMessage({ user_id, role, content, image_url }) {
  const res = await pool.query(
    'INSERT INTO chat_messages (user_id, role, content, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
    [user_id, role, content, image_url || null]
  );
  return res.rows[0];
}

export async function getChatHistory(user_id) {
  const res = await pool.query(
    'SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC',
    [user_id]
  );
  return res.rows;
}

export async function saveVideoHistory({ user_id, video_url, description }) {
  const res = await pool.query(
    'INSERT INTO video_history (user_id, video_url, description) VALUES ($1, $2, $3) RETURNING *',
    [user_id, video_url, description || null]
  );
  return res.rows[0];
}

export async function getVideoHistory(user_id) {
  const res = await pool.query(
    'SELECT * FROM video_history WHERE user_id = $1 ORDER BY created_at ASC',
    [user_id]
  );
  return res.rows;
}
