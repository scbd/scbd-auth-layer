import type { NuxtApp } from "#app";
import { AnonymousUser } from "~/data/AnonymousUser";
import type { AuthUser } from "../types/scbd-auth-user";

import { initAuhtIFrame, getToken, getUser } from "./scbd-auth-scheme";
import { installScbdAuthSessionTimeout } from "./scbd-auth-session-timeout";

const defineNuxtPlugin = async (nuxtApp: NuxtApp) => {  
  const token = useState('auth:token', ()=>ref<string|null>(null))
  const user  = useState('auth:user',  ()=>ref<AuthUser|null>(AnonymousUser))

  // Skip plugin when rendering error page
  if (nuxtApp.payload.error) {
    return;
  }

  const frame = await initAuhtIFrame();

  token.value = (await getToken(frame))?.authenticationToken || null;
  user .value = await getUser(token);
};

export const scbdAuthSsoPlugin = async (nuxtApp: any) => {
  addRouteMiddleware("auth", scbdAuthMiddleware(useScbdAuthSso), { global: true });
  const plugin = await defineNuxtPlugin(nuxtApp);
  const { isAuthenticated, logout } = useScbdAuthSso();

  // Auth state is initialized above; now watch it for inactivity.
  installScbdAuthSessionTimeout(nuxtApp, { isAuthenticated, logout });

  return plugin;
};
