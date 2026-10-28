// ============================================
// domain/policies/agent-token.policy.ts — a server agent's credential
// ============================================
// The token is random, shown once, and stored only as its SHA-256 digest: a database leak does not
// let anyone report as a server. Its first characters (the prefix) are stored in clear so an
// operator can tell two tokens apart.

import { createHash, randomBytes } from "node:crypto";

/** Every agent token starts with this, so a leaked one is recognisable in a secret scan. */
export const AGENT_TOKEN_MARKER = "opsagent_";
/** Random bytes in a token (256 bits). */
const AGENT_TOKEN_BYTES = 32;
/** Characters of the token kept in clear (`OpsServer.agentTokenPrefix`, `VarChar(16)`). */
export const AGENT_TOKEN_PREFIX_LENGTH = 16;

/** A freshly issued token: the secret to hand the operator once, and what is stored. */
export interface IssuedAgentToken {
	readonly token: string;
	readonly hash: string;
	readonly prefix: string;
}

/** The stored digest of a token. */
export function hashAgentToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** A new random token with its digest and prefix. */
export function issueAgentToken(): IssuedAgentToken {
	const token = `${AGENT_TOKEN_MARKER}${randomBytes(AGENT_TOKEN_BYTES).toString("base64url")}`;
	return { token, hash: hashAgentToken(token), prefix: token.slice(0, AGENT_TOKEN_PREFIX_LENGTH) };
}

/** The bearer token of an `Authorization` header, or `null` when there is none. */
export function bearerToken(header: string | undefined): string | null {
	const match = /^Bearer\s+(?<token>\S+)$/i.exec(header ?? "");
	return match?.groups?.token ?? null;
}
