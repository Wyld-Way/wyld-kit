import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface UseRequireAuthOptions {
  /** Where to redirect if not authenticated. Default: '/login' */
  loginPath?: string
  /** Query params to append (e.g. { redirect: '/setup', role: 'head' }) */
  params?: Record<string, string>
}

/**
 * Redirects to login if user is not authenticated.
 * Returns { isReady } — false while auth is loading or redirecting.
 *
 * Usage:
 *   const { isReady } = useRequireAuth(isAuthenticated, isLoading)
 *   if (!isReady) return <Loading />
 */
export function useRequireAuth(
  isAuthenticated: boolean,
  isLoading: boolean,
  options?: UseRequireAuthOptions
) {
  const router = useRouter()
  const { loginPath = '/login', params } = options || {}

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const search = params
        ? '?' + new URLSearchParams(params).toString()
        : ''
      router.replace(loginPath + search)
    }
  }, [isLoading, isAuthenticated, loginPath, params, router])

  return { isReady: !isLoading && isAuthenticated }
}
