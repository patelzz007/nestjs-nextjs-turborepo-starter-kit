import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { ValidateResetTokenResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdentityReadPort } from "../../ports/identity-read.port";
import { CREDENTIAL_CRYPTO, IDENTITY_READ } from "../../ports/identity.tokens";
import { CheckPasswordResetTokenQuery } from "./check-password-reset-token.query";

@QueryHandler(CheckPasswordResetTokenQuery)
export class CheckPasswordResetTokenHandler implements IQueryHandler<CheckPasswordResetTokenQuery, ValidateResetTokenResponse> {
	public constructor(
		@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: CheckPasswordResetTokenQuery): Promise<ValidateResetTokenResponse> {
		const candidate = await this.reads.findUsableResetTokenHash(query.actor, this.crypto.hashTokenDigest(query.input.token), this.clock.now());
		return { valid: candidate !== null && (await this.crypto.compare(query.input.token, candidate.tokenHash)) };
	}
}
