import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { ReferenceDataSyncPort, ReferenceDataSyncReport } from "../../ports/catalog-sync.port";
import { REFERENCE_DATA_SYNC } from "../../ports/authorization.tokens";
import { SyncReferenceDataCommand } from "./sync-reference-data.command";

/** Each section commits on its own (a failing section rolls back alone; a re-run continues from there). */
@CommandHandler(SyncReferenceDataCommand)
export class SyncReferenceDataHandler implements ICommandHandler<SyncReferenceDataCommand, ReferenceDataSyncReport> {
	public constructor(@Inject(REFERENCE_DATA_SYNC) private readonly referenceData: ReferenceDataSyncPort) {}

	public async execute(_command: SyncReferenceDataCommand): Promise<ReferenceDataSyncReport> {
		return this.referenceData.sync();
	}
}
