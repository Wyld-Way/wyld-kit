// URL utilities — pure functions used across rewyld + kripa for
// post-auth redirect safety, link sanitization, and form input
// normalization.
//
// Lifted into @wyld/kit/url 2026-05-04 to eliminate the comment-as-
// contract sync between consumers ("if you change this, mirror it
// in the test file" — easy to forget). All functions here are pure
// and deterministic; no side effects, no axios, no DOM, no React.

/**
 * Validate a returnTo path for post-auth redirect.
 *
 * Rejects:
 *   - null / empty   → fallback
 *   - non-/ paths    → fallback (absolute URLs, javascript:, data:)
 *   - leading //     → fallback (open-redirect via protocol-relative)
 *   - /login + /login/* + /login?* → fallback (post-auth loop)
 *
 * Returns the path as-is if same-origin and not a login subpath.
 *
 * @param raw The candidate path (typically `searchParams.get('returnTo')`)
 * @param fallback Where to send the user when raw is unsafe. Default `/me/profile`.
 */
export function safeReturnTo(raw: string | null, fallback: string = '/me/profile'): string {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  if (raw === '/login' || raw.startsWith('/login/') || raw.startsWith('/login?')) {
    return fallback
  }
  return raw
}

/**
 * Strict http(s) URL sanitizer for stored values that get rendered as
 * href attributes. Returns:
 *   - ''   when input is empty (clears the field)
 *   - the input as-is when it parses as a valid http or https URL
 *   - null when input is non-empty but not a valid http(s) URL
 *
 * The directory page renders `website` and social links as href, so
 * any value that survives this function is XSS-safe (no javascript:,
 * data:, vbscript:, mailto:, raw text). Use with auto-prefix logic
 * (normalizeUrl) on blur so users typing bare hostnames don't get
 * rejected — sanitizeExternalUrl is the strict last-line check.
 */
export function sanitizeExternalUrl(input: string): string | null {
  if (!input) return ''
  try {
    const u = new URL(input)
    if (u.protocol === 'http:' || u.protocol === 'https:') return input
    return null
  } catch {
    return null
  }
}

/**
 * Auto-prefix `https://` when the user types a bare hostname like
 * `instagram.com/handle` or `myblog.substack.com`. Only triggers when
 * the input has a dot, no spaces, doesn't start with `/`, and has no
 * protocol yet. Saves users from the friction of remembering https://
 * — most non-developer users don't think in URLs.
 *
 * Pure: returns the (possibly prefixed) string. Doesn't validate;
 * pair with validateUrlValue or sanitizeExternalUrl for the strict
 * check.
 */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (
    trimmed.includes('.') &&
    !trimmed.includes(' ') &&
    !trimmed.startsWith('/')
  ) {
    return `https://${trimmed}`
  }
  return trimmed
}

/**
 * Returns null when value is empty (optional fields) or a valid
 * http(s) URL. Returns a short error string otherwise. Designed for
 * inline per-field rendering — concise, lowercase, no period.
 */
export function validateUrlValue(value: string): string | null {
  if (!value) return null
  try {
    const u = new URL(value)
    if (u.protocol === 'http:' || u.protocol === 'https:') return null
    return 'use http:// or https://'
  } catch {
    return 'doesn’t look like a URL'
  }
}
