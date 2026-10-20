import { Injectable } from "@nestjs/common";

import type { ClaimIdGenerator } from "../../application/ports/claims.tokens";
import { newRowId } from "@workspace/shared";

/** Claim and OTP challenge ids (UUID v7 row ids), chosen before insert so the response can name them. */
@Injectable()
export class UuidClaimIdGenerator implements ClaimIdGenerator {
	public next(): string {
		return newRowId();
	}
}
