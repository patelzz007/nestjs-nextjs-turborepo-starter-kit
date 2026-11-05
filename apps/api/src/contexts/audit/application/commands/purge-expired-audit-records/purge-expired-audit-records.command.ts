import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { AuditRetentionRunRecord } from "../../ports/audit-retention.port";

/** Remove audit records past the ten-year retention (or, `dryRun`, only count them). ADR 078. */
export class PurgeExpiredAuditRecordsCommand extends Command<readonly AuditRetentionRunRecord[]> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly dryRun: boolean,
	) {
		super();
	}
}
