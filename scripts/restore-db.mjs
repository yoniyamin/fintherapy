#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stdin as input, stdout as output } from 'node:process'
import {
  postgresDumpEnv,
  printPostgresToolsInstallHint,
  printSupabaseDbUrlHint,
  resolvePsqlCli,
  validateSupabaseDbUrl,
} from './cli-utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/** Loads key=value pairs from .env.local without overwriting existing env vars. */
function loadEnvLocal() {
  const envPath = resolve(root, '.env.local')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

/** Extracts the Supabase project ref from a postgres connection string. */
function extractProjectRef(dbUrl) {
  const match = dbUrl.match(/postgres(?:ql)?:\/\/postgres(?:\.([a-z0-9]+))?:/i)
  if (match?.[1]) return match[1]
  const hostMatch = dbUrl.match(/@db\.([a-z0-9]+)\.supabase\.co/i)
  return hostMatch?.[1] ?? 'unknown'
}

/** Resolves the backup directory from CLI args or prints usage and exits. */
function resolveBackupDir(argv) {
  const arg = argv[0]
  if (!arg) {
    console.error('Usage: npm run restore:db -- backups/<timestamp>')
    process.exit(1)
  }

  const backupDir = resolve(process.cwd(), arg)
  for (const file of ['roles.sql', 'schema.sql', 'data.sql']) {
    if (!existsSync(resolve(backupDir, file))) {
      console.error(`Missing ${file} in ${backupDir}`)
      process.exit(1)
    }
  }

  return backupDir
}

/** Drops household schemas and resets public before a full logical restore. */
function runPreRestoreCleanup(psqlCli, dbUrl) {
  const cleanupSql = `
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT nspname FROM pg_namespace WHERE nspname LIKE 'hh\\_%' ESCAPE '\\' LOOP
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', r.nspname);
  END LOOP;
END $$;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;
`

  console.log('Dropping household schemas and resetting public schema...')
  const psqlShell = process.platform === 'win32' && !psqlCli.includes('\\') && !psqlCli.includes('/')
  const result = spawnSync(
    psqlCli,
    ['--dbname', dbUrl, '--single-transaction', '--variable', 'ON_ERROR_STOP=1', '--command', cleanupSql],
    { stdio: 'inherit', env: postgresDumpEnv(), shell: psqlShell },
  )
  if (result.status !== 0) {
    console.error('Pre-restore cleanup failed.')
    process.exit(1)
  }
}

/** Restores roles, schema, and data from a backup directory. */
function runRestore(psqlCli, dbUrl, backupDir) {
  console.log('Restoring roles, schema, and data...')
  const psqlShell = process.platform === 'win32' && !psqlCli.includes('\\') && !psqlCli.includes('/')
  const result = spawnSync(
    psqlCli,
    [
      '--dbname', dbUrl,
      '--single-transaction',
      '--variable', 'ON_ERROR_STOP=1',
      '--file', 'roles.sql',
      '--file', 'schema.sql',
      '--command', 'SET session_replication_role = replica',
      '--file', 'data.sql',
    ],
    { cwd: backupDir, stdio: 'inherit', env: postgresDumpEnv(), shell: psqlShell },
  )
  if (result.status !== 0) {
    console.error('Restore failed. The database may be in a partial state — try an earlier backup.')
    process.exit(1)
  }
}

loadEnvLocal()

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('SUPABASE_DB_URL is not set. Add it to .env.local before restoring.')
  printSupabaseDbUrlHint()
  process.exit(1)
}

validateSupabaseDbUrl(dbUrl)

const psqlCli = resolvePsqlCli()
if (!psqlCli) {
  printPostgresToolsInstallHint()
  process.exit(1)
}

const backupDir = resolveBackupDir(process.argv.slice(2))
const projectRef = extractProjectRef(dbUrl)
const manifestPath = resolve(backupDir, 'manifest.json')
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : null

console.log('')
console.log('WARNING: This will overwrite your live Supabase database.')
console.log(`  Target project: ${projectRef}`)
console.log(`  Backup folder:  ${backupDir}`)
if (manifest?.createdAt) {
  console.log(`  Backup taken:   ${manifest.createdAt}`)
}
console.log('')
console.log('Run a fresh backup first if you are unsure this snapshot is correct.')
console.log('')

const rl = createInterface({ input, output })
const typed = await rl.question(`Type the project ref "${projectRef}" to continue: `)
rl.close()

if (typed.trim() !== projectRef) {
  console.error('Project ref did not match. Restore cancelled.')
  process.exit(1)
}

runPreRestoreCleanup(psqlCli, dbUrl)
runRestore(psqlCli, dbUrl, backupDir)

console.log('')
console.log('Restore complete.')
console.log('Verify the app, then re-apply any migrations that were rolled back.')
