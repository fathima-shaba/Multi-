import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readConfig } from '../src/config.js';
import { createPool, transaction } from '../src/db.js';

const pool = createPool(readConfig().databaseUrl);
const directory = new URL('./migrations/', import.meta.url);
try {
  const applied = await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(5321901)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const completed = [];
    for (const filename of (await readdir(directory)).filter(name => /^\d+_.*\.sql$/.test(name)).sort()) {
      const sql = await readFile(new URL(filename, directory), 'utf8');
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE filename = $1', [filename]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error('Applied migration changed: ' + filename);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename, checksum) VALUES ($1, $2)', [filename, checksum]);
      completed.push(filename);
    }
    return completed;
  });
  console.log(applied.length ? 'Applied: ' + applied.join(', ') : 'Database migrations are up to date.');
} catch (error) {
  console.error('Migration failed:', error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
