// ============================================
// infrastructure/persistence/operations-scope.factory.ts — the repositories of one transaction
// ============================================
// Design patterns:
//   - FACTORY: builds every repository of `OperationsScope` on the unit of work's transaction (never
//     cached), plus the transactional email port, so an alert email commits with its alert row.

import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { NotificationsTransactionalPortsFactory } from "../../../notifications/public-api";
import type { OperationsReadScope, OperationsScope } from "../../application/operations-scope";
import { createPrismaLoadTestTenant } from "../load-test/prisma-load-test-tenant";
import {
	PrismaLoadTestRepository,
	PrismaOpsAlertRecipientsReader,
	PrismaOpsAlertRepository,
	PrismaOpsBackupRepository,
	PrismaOpsHistoryRepository,
	PrismaOpsRestoreDrillRepository,
	PrismaOpsServerRepository,
	PrismaOpsSettingsRepository,
} from "./prisma-operations.repositories";
import { PrismaStatusIncidentRepository } from "./prisma-status-incident.repository";

/** The read-only repositories on one transaction. */
export function createOperationsReadScope(db: Prisma.TransactionClient): OperationsReadScope {
	return {
		servers: new PrismaOpsServerRepository(db),
		history: new PrismaOpsHistoryRepository(db),
		alerts: new PrismaOpsAlertRepository(db),
		settings: new PrismaOpsSettingsRepository(db),
		recipients: new PrismaOpsAlertRecipientsReader(db),
		backups: new PrismaOpsBackupRepository(db),
		restoreDrills: new PrismaOpsRestoreDrillRepository(db),
		statusIncidents: new PrismaStatusIncidentRepository(db, "staff"),
		loadTests: new PrismaLoadTestRepository(db),
		loadTestTenant: createPrismaLoadTestTenant(db),
	};
}

export class OperationsScopeFactory implements ScopeFactory<OperationsScope, Prisma.TransactionClient> {
	public constructor(private readonly notifications: NotificationsTransactionalPortsFactory) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): OperationsScope {
		const loadTestTenant = createPrismaLoadTestTenant(db);
		const notifications = this.notifications.create(db, events);
		return {
			...createOperationsReadScope(db),
			loadTestTenant,
			purge: loadTestTenant,
			emails: notifications.emailRequests,
			notifications: notifications.notifications,
		};
	}
}
