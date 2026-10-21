import { randomBytes } from "node:crypto";

import { newRowId } from "@workspace/shared";

import type { ReferralLinkIdentity, ReferralLinkIdentityGenerator } from "../../application/ports/reward-referral-links.port";

/** Random bytes behind one attribution token: 32 bytes encode to the 43-character base64url token the contract expects. */
const ATTRIBUTION_TOKEN_BYTES = 32;

/** A UUIDv7 row id and an unguessable attribution token per link. */
export class CryptoReferralLinkIdentityGenerator implements ReferralLinkIdentityGenerator {
	public next(): ReferralLinkIdentity {
		return { referralId: newRowId(), attributionToken: randomBytes(ATTRIBUTION_TOKEN_BYTES).toString("base64url") };
	}
}
