export const ENV = {
  appId: import.meta.env.VITE_APP_ID ?? "",
  cookieSecret: import.meta.env.VITE_JWT_SECRET ?? "",
  databaseUrl: import.meta.env.VITE_DATABASE_URL ?? "",

  // OAuth
  oAuthServerUrl: import.meta.env.VITE_OAUTH_SERVER_URL ?? "",

  ownerOpenId: import.meta.env.VITE_OWNER_OPEN_ID ?? "",
  isProduction: import.meta.env.PROD,

  forgeApiUrl: import.meta.env.VITE_BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: import.meta.env.VITE_BUILT_IN_FORGE_API_KEY ?? "",
};
