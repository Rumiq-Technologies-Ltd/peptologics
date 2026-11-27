import "server-only";

import { CognitoJwtVerifier } from "aws-jwt-verify";

import { cognitoSettings } from "./cognito.server";
import { resolveAdminRole, type AdminRole } from "./roles";

/**
 * Token verification (ADR-038). The cookies are httpOnly, but a cookie is still input: every
 * request re-checks signature, issuer, client, token type and expiry before trusting it.
 */
export interface VerifiedSession {
  /** Cognito's stable user id. */
  sub: string;
  email: string;
  /** Null when signed in but in neither group: such a person gets "No access". */
  role: AdminRole | null;
}

interface TokenPair {
  accessToken: string;
  idToken: string;
}

function createVerifiers() {
  const { userPoolId, clientId } = cognitoSettings();

  return {
    access: CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: "access" }),
    id: CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: "id" }),
  };
}

let verifiers: ReturnType<typeof createVerifiers> | undefined;

/** The verified session for a pair of tokens, or null if either fails any check. */
export async function verifyTokenPair(tokens: TokenPair): Promise<VerifiedSession | null> {
  verifiers ??= createVerifiers();

  try {
    const [access, id] = await Promise.all([
      verifiers.access.verify(tokens.accessToken),
      verifiers.id.verify(tokens.idToken),
    ]);

    // The two tokens must belong to the same person.
    if (access.sub !== id.sub) return null;

    const email = typeof id.email === "string" ? id.email : null;
    if (!email) return null;

    const groups = access["cognito:groups"];

    return { sub: access.sub, email, role: resolveAdminRole(groups) };
  } catch {
    // Expired, forged, wrong pool or wrong client: all the same answer. The reason is not
    // logged because a token's content is not ours to put in a log.
    return null;
  }
}
