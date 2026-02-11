export const ENV = {
  appId: process.env.APP_ID ?? "",
  cookieSecret: process.env.COOKIE_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",

  // OAuth
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",

  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
