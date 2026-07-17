#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  hasPostgresDumpTools,
  postgresDumpEnv,
  printConnectionFailureHint,
  printPostgresToolsInstallHint,
  printSupabaseDbUrlHint,
  resolvePgDumpallCli,
  resolvePgDumpCli,
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

/** Runs a pg_dump/pg_dumpall command and exits on failure. */
function runPgTool(executable, args, label, outputFileName, cwd, dbUrl) {
  console.log(`Dumping ${label} → ${resolve(cwd, outputFileName)}`)
  const result = spawnSync(executable, args, {
    cwd,
    stdio: 'inherit',
    env: postgresDumpEnv(),
  })
  if (result.status !== 0) {
    console.error(`Backup failed while dumping ${label}.`)
    printConnectionFailureHint(dbUrl)
    process.exit(1)
  }
}

loadEnvLocal()

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('SUPABASE_DB_URL is not set.')
  printSupabaseDbUrlHint()
  process.exit(1)
}

validateSupabaseDbUrl(dbUrl)

if (!hasPostgresDumpTools()) {
  printPostgresToolsInstallHint()
  process.exit(1)
}

const pgDump = resolvePgDumpCli()
const pgDumpall = resolvePgDumpallCli()

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backupDir = resolve(root, 'backups', timestamp)
mkdirSync(backupDir, { recursive: true })

const rolesPath = resolve(backupDir, 'roles.sql')
const schemaPath = resolve(backupDir, 'schema.sql')
const dataPath = resolve(backupDir, 'data.sql')

runPgTool(pgDumpall, [
  '--dbname', dbUrl,
  '--roles-only',
  '--no-role-passwords',
  '-f', 'roles.sql',
], 'roles', 'roles.sql', backupDir, dbUrl)

runPgTool(pgDump, [
  '--dbname', dbUrl,
  '--schema-only',
  '--no-owner',
  '--no-privileges',
  '-f', 'schema.sql',
], 'schema', 'schema.sql', backupDir, dbUrl)

runPgTool(pgDump, [
  '--dbname', dbUrl,
  '--data-only',
  '--no-owner',
  '--exclude-table=storage.buckets_vectors',
  '--exclude-table=storage.vector_indexes',
  '-f', 'data.sql',
], 'data', 'data.sql', backupDir, dbUrl)

const manifest = {
  createdAt: new Date().toISOString(),
  projectRef: extractProjectRef(dbUrl),
  files: ['roles.sql', 'schema.sql', 'data.sql'],
  sizes: {
    rolesBytes: statSync(rolesPath).size,
    schemaBytes: statSync(schemaPath).size,
    dataBytes: statSync(dataPath).size,
  },
}

writeFileSync(resolve(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log('')
console.log('Backup complete.')
console.log(`  Directory: ${backupDir}`)
console.log(`  Project:   ${manifest.projectRef}`)
console.log('')
console.log('Restore with:')
console.log(`  npm run restore:db -- ${backupDir.replace(/\\/g, '/')}`)
