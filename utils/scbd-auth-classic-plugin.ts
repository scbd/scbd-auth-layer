import { AnonymousUser } from '~/data/AnonymousUser';
import type { AuthUser } from '../types/scbd-auth-user'
import { getUser } from './scbd-auth-scheme'
import { installScbdAuthSessionTimeout } from './scbd-auth-session-timeout'

const STORAGE_KEY_TOKEN = 'classic:token'
const STORAGE_KEY_EXPIRATION = 'classic:tokenExpiration'

const defineNuxtPlugin = async (nuxtApp: any) => {
  const token = useState('auth:token', () => ref<string | null>(null))
  const user = useState('auth:user', () => ref<AuthUser | null>(AnonymousUser))

  if (nuxtApp.payload.error) return

  const storedToken = localStorage.getItem(STORAGE_KEY_TOKEN)
  const storedExpiration = localStorage.getItem(STORAGE_KEY_EXPIRATION)

  if (!storedToken || !storedExpiration) {
    user.value = AnonymousUser
    return
  }

  if (new Date(storedExpiration) <= new Date()) {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_EXPIRATION)
    user.value = AnonymousUser
    return
  }

  token.value = storedToken

  try {
    const fetchedUser = await getUser(token)
    user.value = fetchedUser ?? AnonymousUser
  } catch {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_EXPIRATION)
    token.value = null
    user.value = AnonymousUser
  }
};

export const scbdAuthClassicPlugin = async (nuxtApp: any) => {
  addRouteMiddleware("auth", scbdAuthMiddleware(useScbdAuthClassic), { global: true });
  const plugin = await defineNuxtPlugin(nuxtApp);
  const { isAuthenticated, logout } = useScbdAuthClassic();

  // Auth state is initialized above; now watch it for inactivity.
  installScbdAuthSessionTimeout(nuxtApp, { isAuthenticated, logout });

  return plugin;
};
