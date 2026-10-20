import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, type EpochMs } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUDIT_LOG_RETENTION_OPERATION, AUTHORIZATION_UNIT_OF_WORK } from "../../ports/authorization.tokens";
import { PurgeOldPermissionAuditLogsCommand } from "./purge-old-permission-audit-logs.command";

/** Days → ms, for the retention window below. */
const MS_PER_DAY: number = 24 * 60 * 60 * 1000;

/** Permission audit rows are retained for 90 days, then soft-deleted (never hard-deleted). */
export const PERMISSION_AUDIT_RETENTION_MS: number = 90 * MS_PER_DAY;

/** One UPDATE on the `createdAt` index, under `maintenance.audit_log_retention`. */
@CommandHandler(PurgeOldPermissionAuditLogsCommand)
export class PurgeOldPermissionAuditLogsHandler implements ICommandHandler<PurgeOldPermissionAuditLogsCommand, number> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: PurgeOldPermissionAuditLogsCommand): Promise<number> {
		return this.uow.runSystemOperation(AUDIT_LOG_RETENTION_OPERATION, command.actor, async (scope: AuthorizationScope): Promise<number> => {
			const now: EpochMs = this.clock.now();
			return scope.permissionAudit.retireCreatedBefore(epochMs(now - PERMISSION_AUDIT_RETENTION_MS), now);
		});
	}
}
