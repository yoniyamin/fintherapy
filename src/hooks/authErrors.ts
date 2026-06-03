const ERROR_MAP: [test: RegExp, friendly: string][] = [
  [/invalid login credentials/i, 'Wrong email or password. Please try again.'],
  [/user already registered/i, 'An account with this email already exists.'],
  [/email not confirmed/i, 'Please confirm your email before signing in.'],
  [/signup is disabled/i, 'Signups are currently disabled. Contact an admin.'],
  [/rate limit/i, 'Too many attempts. Please wait a moment and try again.'],
]

export function friendlyAuthError(raw: string): string {
  for (const [re, friendly] of ERROR_MAP) {
    if (re.test(raw)) return friendly
  }
  return raw
}
