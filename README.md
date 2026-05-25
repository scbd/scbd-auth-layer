# SCBD Auth

Everything needed to implement authentication/authorization in a Nuxt project. SSO and classic are available.

## Local build

Make sure to install dependencies:

```bash
# install dependencies
yarn install
# build
yarn build
```

## Setup in a Nuxt project

Add the layer to your project

```ts
// nuxt.config.ts

export default defineNuxtConfig({
  ...
  extends: [
    'github:scbd/auth'
  ],
  ...
})
```

Make sure Auth API URL is available to the environment

```
# .env (for example)

NUXT_PUBLIC_AUTH_API_URL=...
```

By default, authenticated sessions time out after 30 minutes of inactivity. Browser activity and route changes reset the timer, and activity is shared across tabs. Set `NUXT_PUBLIC_AUTH_INACTIVITY_TIMEOUT_MINUTES=0` to disable it, or set another number of minutes to change the timeout.

Add plugin to initialize

```ts
// app/plugins/scbd-auth.ts

// standard
export default defineNuxtPlugin(scbdAuthSsoPlugin) 

// classic
// export default defineNuxtPlugin(scbdAuthClassicPlugin)
```

Create a login page (example with composition approach)

```html
<!-- app/pages/login.vue -->

<template>
  ...
    <div v-if="!isAuthenticated">
      <!-- standard --> 
      <ScbdAuthSsoLoginForm />

      <!-- classic -->
      <!-- <ScbdAuthClassicLoginForm /> -->
    </div>
    <div v-else>
      ...
      <div>
        You are logged in as {{ user?.name }}
      </div>
      ...
      <CButton @click="logout('/')">
        Logout
      </CButton>
    </div>
  ...
</template>     

<script setup lang="ts">
const { isAuthenticated, logout, user } = useScbdAuthSso() // or useScbdAuthClassic()
...
</script>
```
