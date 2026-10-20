import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { VerifyBackupCodeResponse } from "@workspace/shared";

import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdentityReadPort } from "../../ports/identity-read.port";
import { CREDENTIAL_CRYPTO, IDENTITY_READ } from "../../ports/identity.tokens";
import { CheckBackupCodeQuery } from "./check-backup-code.query";

/** Whether a backup code matches one of the caller's unused codes. Never consumes it. */
@QueryHandler(CheckBackupCodeQuery)
export class CheckBackupCodeHandler implements IQueryHandler<CheckBackupCodeQuery, VerifyBackupCodeResponse> {
	public constructor(
		@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
	) {}

	public async execute(query: CheckBackupCodeQuery): Promise<VerifyBackupCodeResponse> {
		for (const hash of await this.reads.unusedBackupCodeHashes(query.actor, query.input.userId)) {
			if (await this.crypto.compare(query.input.backupCode, hash)) {
				return { valid: true };
			}
		}
		return { valid: false };
	}
}
