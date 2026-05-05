import type { AxiosInstance } from 'axios'

// Shared auth client. App provides its own axios instance (so it
// keeps its own bearer-token interceptor, baseURL, error handling).
// Service exposes the standard auth surface every app needs:
// login, signup, password reset, change password, email verification,
// OAuth (Google + Apple), profile updates, current-user, logout.
//
// Backend routes (consumer-app surface):
//   POST /v1/auth/login
//   POST /v1/auth/signup
//   POST /v1/auth/google-login
//   POST /v1/auth/apple-login
//   POST /v1/auth/forgot-password
//   POST /v1/auth/reset-password
//   POST /v1/auth/change-password
//   POST /v1/auth/verify-account
//   POST /v1/auth/resend-email
//   PATCH /v1/auth/edit-profile
//   GET  /v1/auth/user-details
//   GET  /v1/auth/me
//
// Note: paths here OMIT the `/v1` prefix because each app's axios
// baseURL already includes it (per ecosystem convention). If your
// client doesn't, set baseURL to include `/v1` before constructing.
//
// Admin auth duality (separate /v1/admin/auth/login + admin user
// details) is INTENTIONALLY not lifted — kit consolidates on the
// unified /v1/auth/* routes with role-gated access via memberships.
// See rewyld-to-kripa-port-audit.md opportunity #2.

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

export interface SignupPayload {
  first_name: string
  last_name: string
  email: string
  password: string
  /** Optional referral code from a guide's share link. */
  referral_code?: string
  recaptchaV2Token?: string
  /** Legacy v3 token; some callers still send both. */
  recaptchaToken?: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export interface ProfileUpdatePayload {
  first_name?: string
  last_name?: string
  /** Multipart File. Sends as form-data; backend reads from
   * req.files.profile_photo. */
  profile_photo?: File
}

export interface MembershipInfo {
  /** tbl_organization_membership.id — needed by callers that mutate
   * specific membership rows (e.g. role updates, leave-org). */
  id: string
  /** tbl_organization_membership.user_id — same as the wrapping user;
   * present for callers expecting the full row shape. */
  user_id: string
  org_id: string
  role: string
  status: string
  organization: {
    id: string
    slug: string
    name: string
    type: string
    logo_url: string | null
  } | null
}

export interface MeFullResponse {
  user: AuthUser
  memberships: MembershipInfo[]
}

export interface AuthService {
  login(payload: LoginPayload): Promise<LoginResponse>
  /**
   * Self-signup. Backend issues a JWT in the response so the user is
   * auto-logged-in (`storage.setToken` runs on success).
   * Backend route: POST /v1/auth/signup
   */
  signup(payload: SignupPayload): Promise<LoginResponse>
  /**
   * Google OAuth login. Pass the idToken (Google's "credential" string)
   * from @react-oauth/google's GoogleLogin onSuccess callback.
   * Backend route: POST /v1/auth/google-login
   */
  googleLogin(idToken: string): Promise<LoginResponse>
  /**
   * Apple OAuth login. Pass the id_token from Apple's auth response.
   * Backend route: POST /v1/auth/apple-login
   */
  appleLogin(idToken: string): Promise<LoginResponse>
  forgotPassword(email: string): Promise<{ message?: string }>
  resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ message?: string }>
  /**
   * Authenticated password change. Requires a valid bearer token on
   * the underlying axios client.
   * Backend route: POST /v1/auth/change-password
   */
  changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ message?: string }>
  /**
   * Email verification — exchanges the token from the verification
   * email for a JWT (auto-login post-verification).
   * Backend route: POST /v1/auth/verify-account
   */
  verifyAccount(token: string): Promise<LoginResponse>
  /**
   * Resend the verification email. Returns success regardless of
   * whether the email exists (prevents enumeration); surface the
   * message to the user as-is.
   * Backend route: POST /v1/auth/resend-email
   */
  resendVerificationEmail(email: string): Promise<{ message?: string }>
  /**
   * Generic user profile update — first_name, last_name, and the
   * round profile photo. NOT for guide-profile fields (bio, skills,
   * audiences, cover, gallery) — those go through guide.update-profile.
   * Backend route: PATCH /v1/auth/edit-profile
   */
  updateProfile(payload: ProfileUpdatePayload): Promise<{ user?: AuthUser; message?: string }>
  /**
   * Legacy /v1/auth/user-details. Stays alive for iOS app + any consumer
   * that doesn't need memberships. Returns user-only shape.
   */
  fetchMe(): Promise<AuthUser>
  /**
   * /v1/auth/me — unified endpoint returning user + active org
   * memberships in one round-trip. Tenant apps (Kripa, Schools) should
   * prefer this over fetchMe + a separate /organizations/mine call.
   */
  fetchMeFull(): Promise<MeFullResponse>
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

    async signup(payload) {
      const body: Record<string, unknown> = {
        login_type: 'S',
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        termsAndPrivacy: true,
      }
      if (payload.referral_code) body.referral_code = payload.referral_code
      if (payload.recaptchaV2Token) body.recaptchaV2Token = payload.recaptchaV2Token
      if (payload.recaptchaToken) body.recaptchaToken = payload.recaptchaToken

      const res = await client.post('/auth/signup', body)
      const envelope = res.data as { status?: string; data?: LoginResponse }
      const data = envelope?.data
      if (!data || !data.token) {
        throw new Error('Signup response missing token')
      }
      opts.storage?.setToken(data.token)
      return data
    },

    async googleLogin(idToken) {
      const res = await client.post('/auth/google-login', { idToken })
      const envelope = res.data as { status?: string; data?: LoginResponse }
      const data = envelope?.data
      if (!data || !data.token) {
        throw new Error('Google login response missing token')
      }
      opts.storage?.setToken(data.token)
      return data
    },

    async appleLogin(idToken) {
      const res = await client.post('/auth/apple-login', { idToken })
      const envelope = res.data as { status?: string; data?: LoginResponse }
      const data = envelope?.data
      if (!data || !data.token) {
        throw new Error('Apple login response missing token')
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

    async changePassword(currentPassword, newPassword, confirmPassword) {
      const res = await client.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      const envelope = res.data as { status?: string; message?: string }
      return { message: envelope?.message }
    },

    async verifyAccount(token) {
      const res = await client.post('/auth/verify-account', {
        verify_token: token,
      })
      const envelope = res.data as { status?: string; data?: LoginResponse }
      const data = envelope?.data
      if (!data || !data.token) {
        throw new Error('Verify-account response missing token')
      }
      opts.storage?.setToken(data.token)
      return data
    },

    async resendVerificationEmail(email) {
      // Same enumeration-prevention as forgotPassword: backend returns
      // generic success regardless of whether the email exists.
      const res = await client.post('/auth/resend-email', {
        email: email.trim().toLowerCase(),
      })
      const envelope = res.data as { status?: string; message?: string }
      return { message: envelope?.message }
    },

    async updateProfile(payload) {
      // Multipart: backend reads File from req.files.profile_photo and
      // text fields from req.body. Letting axios infer Content-Type from
      // FormData is correct; explicitly setting 'multipart/form-data'
      // without a boundary breaks some servers, so we don't pass headers.
      const formData = new FormData()
      if (payload.first_name !== undefined) {
        formData.append('first_name', payload.first_name)
      }
      if (payload.last_name !== undefined) {
        formData.append('last_name', payload.last_name)
      }
      if (payload.profile_photo) {
        formData.append('profile_photo', payload.profile_photo)
      }
      const res = await client.patch('/auth/edit-profile', formData)
      const envelope = res.data as {
        status?: string
        message?: string
        data?: AuthUser
      }
      return { user: envelope?.data, message: envelope?.message }
    },

    async fetchMe() {
      const res = await client.get('/auth/user-details')
      const envelope = res.data as { status?: string; data?: AuthUser }
      if (!envelope?.data) throw new Error('No user details returned')
      return envelope.data
    },

    async fetchMeFull() {
      const res = await client.get('/auth/me')
      const envelope = res.data as {
        status?: string
        data?: AuthUser & { memberships?: MembershipInfo[] }
      }
      const data = envelope?.data
      if (!data) throw new Error('No user details returned from /auth/me')
      const { memberships = [], ...user } = data
      return { user, memberships }
    },

    logout() {
      opts.storage?.setToken(null)
    },
  }
}
