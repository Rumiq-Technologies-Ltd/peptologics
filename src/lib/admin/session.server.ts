import "server-only";

import { fetchAuthSession } from "aws-amplify/auth/server";
import { cookies } from "next/headers";
import { cache } from "react";

import { getAdminAuth } from "./cognito.server";
import { verifyTokenPair, type VerifiedSession } from "./tokens.server";

/**
 * The verified session for the current request, or null. Cached for one render so a layout
 * and a page asking in the same request verify once.
 */
export const getAdminSession = cache(async (): Promise<VerifiedSession | null> => {
  const { runWithAmplifyServerContext } = getAdminAuth();

  const tokens = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (context) => {
      const session = await fetchAuthSession(context);
      return {
        accessToken: session.tokens?.accessToken?.toString(),
        idToken: session.tokens?.idToken?.toString(),
      };
    },
  });

  if (!tokens.accessToken || !tokens.idToken) return null;

  return verifyTokenPair({ accessToken: tokens.accessToken, idToken: tokens.idToken });
});
