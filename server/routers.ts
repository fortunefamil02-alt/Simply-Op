import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { jobsRouter } from "./routers/jobs";
import { managerOverridesRouter } from "./routers/manager-overrides";
import { invoicesRouter } from "./routers/invoices";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Job lifecycle API
  jobs: jobsRouter,
  managerOverrides: router(managerOverridesRouter),
  invoices: invoicesRouter,

  // TODO: add more feature routers here, e.g.
  // managers: managersRouter,
  // properties: propertiesRouter,
});

export type AppRouter = typeof appRouter;
