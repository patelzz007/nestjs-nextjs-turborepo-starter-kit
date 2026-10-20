import { randomBytes } from "node:crypto";

import { sha256Hex } from "../../../../platform/infrastructure/crypto/sha256";
import type { InviteTokenPort, IssuedInviteToken } from "../../application/ports/invite-tokens.port";

/** Random bytes in an invite token (hex-encoded in the link; only its SHA-256 is stored). */
const INVITE_TOKEN_BYTES = 32;

export class RandomInviteTokens implements InviteTokenPort {
	public issue(): IssuedInviteToken {
		const rawToken = randomBytes(INVITE_TOKEN_BYTES).toString("hex");
		return { rawToken, tokenHash: sha256Hex(rawToken) };
	}

	public hash(rawToken: string): string {
		return sha256Hex(rawToken);
	}
}
