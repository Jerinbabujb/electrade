/**
 * Database migration runner.
 * Scans src/db/migrations/*.sql in filename order, runs any not yet applied.
 * Called automatically on server startup — safe to run on every deploy.
 */
const fs   = require('fs');
const path = require('path');
const { pool } = require('./index');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);

    // List already-applied migrations
    const { rows } = await client.query(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    const applied = new Set(rows.map(r => r.filename));

    // Read all .sql files, sorted by name
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] Running ${file} ...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)', [file]
        );
        await client.query('COMMIT');
        console.log(`[migrate] ✓ ${file}`);
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ✗ ${file}: ${err.message}`);
        throw err; // Abort startup — don't run on a broken schema
      }
    }

    if (ran === 0) {
      console.log('[migrate] Schema up to date.');
    } else {
      console.log(`[migrate] Applied ${ran} migration(s).`);
    }
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
