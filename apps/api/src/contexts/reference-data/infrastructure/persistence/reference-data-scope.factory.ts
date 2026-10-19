import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { AuditTrailService } from "../../../../platform/infrastructure/audit/audit-trail.service";
import type { ReferenceDataScope } from "../../application/reference-data-scope";
import { AuditTrailRequestAuditAdapter } from "../adapters/audit-trail-request-audit.adapter";
import { PrismaGeographyRepository } from "./prisma-geography.repository";

/** Builds the reference-data scope bound to the unit-of-work transaction. Never cached. */
export class ReferenceDataScopeFactory implements ScopeFactory<ReferenceDataScope, Prisma.TransactionClient> {
	public constructor(private readonly auditTrail: AuditTrailService) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): ReferenceDataScope {
		return {
			geography: new PrismaGeographyRepository(db),
			requestAudit: new AuditTrailRequestAuditAdapter(this.auditTrail, db),
			events,
		};
	}
}
