import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { jobsRouter } from "./routers/jobs";
import { jobsDetailRouter } from "./routers/jobs-detail";
import { managerOverridesRouter } from "./routers/manager-overrides";
import { invoicesRouter } from "./routers/invoices";
import { founderRouter } from "./routers/founder";
import { governanceRouter } from "./routers/governance";
import { businessRouter } from "./routers/business";
import { photosRouter } from "./routers/photos";
import { integrationsRouter } from "./routers/integrations";
import { authRouter } from "./routers/auth";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: authRouter,

  // Job lifecycle API
  jobs: jobsRouter,
  jobsDetail: jobsDetailRouter,
  managerOverrides: router(managerOverridesRouter),
  invoices: invoicesRouter,

  // Founder/Governance API
  founder: founderRouter,
  governance: governanceRouter,

  // Business API
  business: businessRouter,
  photos: photosRouter,

  // Integrations API (Skeleton Only)
  integrations: integrationsRouter,

  // TODO: add more feature routers here, e.g.
  // managers: managersRouter,
  // properties: propertiesRouter,
});

export type AppRouter = typeof appRouter;
