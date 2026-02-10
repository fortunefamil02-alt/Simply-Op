import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * tRPC client for use outside React components.
 * Use this in auth context, service files, and other non-component code.
 * Do NOT use React hooks with this client.
 */
export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getApiBaseUrl()}/api/trpc`,
      transformer: superjson,
      async headers() {
        const token = await Auth.getSessionToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
