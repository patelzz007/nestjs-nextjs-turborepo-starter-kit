import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { BackupCodesRemainingResponse } from "@workspace/shared";

import type { IdentityReadPort } from "../../ports/identity-read.port";
import { IDENTITY_READ } from "../../ports/identity.tokens";
import { CountRemainingBackupCodesQuery } from "./count-remaining-backup-codes.query";

@QueryHandler(CountRemainingBackupCodesQuery)
export class CountRemainingBackupCodesHandler implements IQueryHandler<CountRemainingBackupCodesQuery, BackupCodesRemainingResponse> {
	public constructor(@Inject(IDENTITY_READ) private readonly reads: IdentityReadPort) {}

	public async execute(query: CountRemainingBackupCodesQuery): Promise<BackupCodesRemainingResponse> {
		return { remaining: await this.reads.countUnusedBackupCodes(query.actor, query.input.userId) };
	}
}
