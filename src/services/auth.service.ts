import type { AxiosInstance } from 'axios'

// Shared auth client. App provides its own axios instance (so it
// keeps its own bearer-token interceptor, baseURL, error handling).
// Service exposes the standard auth surface every app needs:
// login, password reset, current-user, logout.
//
// Backend routes (consumer-app surface):
//   POST /v1/auth/login
//   POST /v1/auth/forgot-password
//   POST /v1/auth/reset-password
//   GET  /v1/auth/user-details
//
// Note: paths here OMIT the `/v1` prefix because each app's axios
// baseURL already includes it (per ecosystem convention). If your
// client doesn't, set baseURL to include `/v1` before constructing.

export interface AuthUser {
  id: string | number
  first_name: string | null
  last_name: string | null
  email: string | null
  profile_photo: string | null
  user_type?: string
}

export interface LoginPayload {
  email: string
  password: string
  recaptchaV2Token?: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export interface AuthService {
  login(payload: LoginPayload): Promise<LoginResponse>
  forgotPassword(email: string): Promise<{ message?: string }>
  resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ message?: string }>
  fetchMe(): Promise<AuthUser>
  logout(): void
}

interface AuthServiceOptions {
  // Storage adapter. Lets each app choose where to persist tokens
  // (localStorage on web, cookies on SSR-aware tenants, etc.).
  // Logout clears via this adapter.
  storage?: {
    setToken(token: string | null): void
  }
}

/**
 * Factory: pass your app's axios client + an optional storage adapter.
 *
 * Usage (Kripa):
 *   import http from '@/lib/api/http-client'
 *   import { setStoredToken } from '@/lib/api/http-client'
 *   const auth = createAuthService(http, { storage: { setToken: setStoredToken } })
 *   await auth.forgotPassword('a@b.com')
 *
 * The login call expects backend to return:
 *   { status, data: { token, user } }
 * Other calls expect: { status, message } or { status, data }
 */
export function createAuthService(
  client: AxiosInstance,
  opts: AuthServiceOptions = {}
): AuthService {
  return {
    async login(payload) {
      // login_type 'S' = standard email/password (backend convention)
      const res = await client.post('/auth/login', {
        login_type: 'S',
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        recaptchaV2Token: payload.recaptchaV2Token || undefined,
      })
      const envelope = res.data as { status?: string; data?: LoginResponse }
      const data = envelope?.data
      if (!data || !data.token) {
        throw new Error('Login response missing token')
      }
      opts.storage?.setToken(data.token)
      return data
    },

    async forgotPassword(email) {
      // Backend returns generic success regardless of whether the email
      // exists — prevents email enumeration. Don't infer success/failure
      // from response shape; just surface the message.
      const res = await client.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      })
      const envelope = res.data as { status?: string; message?: string }
      return { message: envelope?.message }
    },

    async resetPassword(token, newPassword, confirmPassword) {
      const res = await client.post('/auth/reset-password', {
        forgot_token: token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      const envelope = res.data as { status?: string; message?: string }
      return { message: envelope?.message }
    },

    async fetchMe() {
      const res = await client.get('/auth/user-details')
      const envelope = res.data as { status?: string; data?: AuthUser }
      if (!envelope?.data) throw new Error('No user details returned')
      return envelope.data
    },

    logout() {
      opts.storage?.setToken(null)
    },
  }
}
