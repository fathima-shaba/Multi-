import pg from 'pg';

export function createPool(databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  pool.on('error', error => console.error('Database pool error', error.code ?? error.name));
  return pool;
}

export async function transaction(pool, operation) {
  const client = await pool.connect();
  let discard;
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      discard = rollbackError;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
