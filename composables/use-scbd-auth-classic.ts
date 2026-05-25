import type { IScbdAuth } from '../types/scbd-auth'
import type { AuthUser } from '../types/scbd-auth-user'
import { signIn as apiSignIn } from '../api/account'
import { getUser } from '../utils/scbd-auth-scheme'

const STORAGE_KEY_TOKEN = 'classic:token'
const STORAGE_KEY_EXPIRATION = 'classic:tokenExpiration'

export function useScbdAuthClassic(): IScbdAuth & { signIn(email: string, password: string): Promise<void> } {
  const token = useState<string | null>('auth:token')
  const user = useState<AuthUser | null>('auth:user')

  const { authApiUrl } = useRuntimeConfig().public

  async function signIn(email: string, password: string): Promise<void> {
    const authToken = await apiSignIn(authApiUrl, email, password)

    token.value = authToken.authenticationToken
    localStorage.setItem(STORAGE_KEY_TOKEN, authToken.authenticationToken)
    localStorage.setItem(STORAGE_KEY_EXPIRATION, authToken.expiration.toISOString())

    user.value = await getUser(token)
  }

  function login(returnTo: Ref<string> | string | null = null) {
    const returnUrl = toValue(returnTo) || '/'
    return navigateTo({ path: '/login', query: { returnUrl } })
  }

  function logout(returnTo: Ref<string> | string | null = null) {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_EXPIRATION)
    token.value = null
    user.value = null

    const returnUrl = toValue(returnTo)

    if (returnUrl) {
      return navigateTo({ path: '/login', query: { returnUrl } })
    }

    return navigateTo('/login')
  }

  function profile(_returnTo: Ref<string> | string | null = null): void {
    // no-op: classic mode has no external profile page
  }

  function hasRole(roleOrRoles: Ref<string[]> | Ref<string> | string[] | string): boolean {
    const testRoles = toValue(roleOrRoles)

    if (!testRoles?.length) return false

    const roles: string[] = user.value?.roles || []

    if (typeof testRoles === 'string') {
      return roles.some((r) => r === testRoles)
    }

    return roles.some((r) => (testRoles as string[]).includes(r))
  }

  return {
    token: computed(() => token.value),
    user: computed(() => user.value),
    isAuthenticated: computed(() => user.value?.isAuthenticated === true),
    login,
    logout,
    profile,
    hasRole,
    signIn
  }
}
