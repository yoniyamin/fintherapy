import { spawnSync } from 'node:child_process'

/** Returns true when a command exits successfully. */
function commandWorks(command, args = ['--version'], options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options }).status === 0
}

/** Collects executable paths returned by where.exe on Windows. */
function whereExecutables(name) {
  if (process.platform !== 'win32') return []

  const where = spawnSync('where.exe', [name], { encoding: 'utf8' })
  if (where.status !== 0) return []

  return where.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Finds the first working executable from PATH or where.exe. */
function resolvePostgresTool(names) {
  for (const name of names) {
    for (const candidate of whereExecutables(name)) {
      if (commandWorks(candidate)) return candidate
    }
    if (commandWorks(name)) return name
  }
  return null
}

/** Finds pg_dump on the current machine, or null when not found. */
export function resolvePgDumpCli() {
  return resolvePostgresTool(['pg_dump', 'pg_dump.exe'])
}

/** Finds pg_dumpall on the current machine, or null when not found. */
export function resolvePgDumpallCli() {
  return resolvePostgresTool(['pg_dumpall', 'pg_dumpall.exe'])
}

/** Finds the psql client on the current machine, or null when not found. */
export function resolvePsqlCli() {
  return resolvePostgresTool(['psql', 'psql.exe'])
}

/** Env vars for remote Supabase connections over SSL. */
export function postgresDumpEnv() {
  return {
    ...process.env,
    PGSSLMODE: process.env.PGSSLMODE ?? 'require',
  }
}

/** Returns true when both pg_dump and pg_dumpall are available. */
export function hasPostgresDumpTools() {
  return Boolean(resolvePgDumpCli() && resolvePgDumpallCli())
}

/** Parses the hostname from a PostgreSQL connection URI. */
export function parseSupabaseDbHost(dbUrl) {
  try {
    const normalized = dbUrl.replace(/^postgres(ql)?:\/\//i, 'https://')
    return new URL(normalized).hostname
  } catch {
    return null
  }
}

/** Parses the port from a PostgreSQL connection URI, defaulting to 5432. */
export function parseSupabaseDbPort(dbUrl) {
  try {
    const normalized = dbUrl.replace(/^postgres(ql)?:\/\//i, 'https://')
    const port = new URL(normalized).port
    return port ? Number(port) : 5432
  } catch {
    return 5432
  }
}

/** Returns true when the host is Supabase direct DB (db.*.supabase.co). */
export function isDirectSupabaseDbHost(host) {
  return Boolean(host && /^db\.[a-z0-9]+\.supabase\.co$/i.test(host))
}

/** Returns true when the host is a Supabase pooler endpoint. */
export function isPoolerSupabaseDbHost(host) {
  return Boolean(host && host.endsWith('.pooler.supabase.com'))
}

/**
 * Validates SUPABASE_DB_URL for pg_dump/psql and exits when misconfigured.
 * Direct db.*.supabase.co hosts often fail DNS on Windows without IPv4 add-on.
 */
export function validateSupabaseDbUrl(dbUrl) {
  const host = parseSupabaseDbHost(dbUrl)
  const port = parseSupabaseDbPort(dbUrl)

  if (!host) {
    console.error('SUPABASE_DB_URL is not a valid PostgreSQL connection URI.')
    printSupabaseDbUrlHint()
    process.exit(1)
  }

  if (isDirectSupabaseDbHost(host) && process.env.SUPABASE_DB_ALLOW_DIRECT !== '1') {
    console.error(`SUPABASE_DB_URL uses direct host "${host}".`)
    console.error('This hostname often fails on Windows (IPv6 / DNS).')
    printSupabaseDbUrlHint()
    process.exit(1)
  }

  if (isPoolerSupabaseDbHost(host) && port === 6543) {
    console.error(`SUPABASE_DB_URL uses transaction pooler port ${port}.`)
    console.error('pg_dump requires Session pooler on port 5432.')
    printSupabaseDbUrlHint()
    process.exit(1)
  }
}

/** Prints how to configure SUPABASE_DB_URL for backup/restore tools. */
export function printSupabaseDbUrlHint() {
  console.error('')
  console.error('Set SUPABASE_DB_URL in .env.local using Supabase Dashboard → Connect:')
  console.error('  • Mode: Session pooler')
  console.error('  • Port: 5432')
  console.error('  • Example:')
  console.error('    SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres')
  console.error('')
  console.error('To force the direct db.*.supabase.co host anyway, set SUPABASE_DB_ALLOW_DIRECT=1.')
  console.error('')
}

/** Prints connection hints after a pg_dump/psql network failure. */
export function printConnectionFailureHint(dbUrl) {
  printSupabaseDbUrlHint()
  const host = parseSupabaseDbHost(dbUrl)
  if (host && isDirectSupabaseDbHost(host)) {
    console.error(`Could not reach "${host}". Switch to the session pooler URI (port 5432).`)
  }
}

/** Prints install instructions when PostgreSQL client tools are missing. */
export function printPostgresToolsInstallHint() {
  console.error('Missing required commands: pg_dump and pg_dumpall')
  console.error('Install PostgreSQL client tools (includes psql for restore):')
  console.error('  https://www.postgresql.org/download/windows/')
  console.error('Add the bin folder to PATH, e.g.:')
  console.error('  C:\\Program Files\\PostgreSQL\\17\\bin')
}
