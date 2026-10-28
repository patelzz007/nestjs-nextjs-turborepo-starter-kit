import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, newRowId, type SupportAccessGrantResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { SupportAccessGrantAggregate, type SupportAccessGrantState } from "../../../domain/aggregates/support-access-grant.aggregate";
import { SupportAccessTenantNotFoundError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, SUPPORT_ACCESS_GRANT_OPERATION } from "../../ports/authorization.tokens";
import { requireUserActor } from "../../services/rbac-actor";
import { SUPPORT_ACCESS_AUDIT_ACTIONS, SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE } from "../../services/support-access-audit";
import { RequestSupportAccessCommand } from "./request-support-access.command";

/** The grant and its tenant audit row (real actor + active policy version) commit together under `support_access.grant`. */
@CommandHandler(RequestSupportAccessCommand)
export class RequestSupportAccessHandler implements ICommandHandler<RequestSupportAccessCommand, SupportAccessGrantResponse> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestSupportAccessCommand): Promise<SupportAccessGrantResponse> {
		const { input } = command;
		const actor = requireUserActor(command.actor);
		const grant: SupportAccessGrantState = await this.uow.runSystemOperation(
			SUPPORT_ACCESS_GRANT_OPERATION,
			actor,
			async (scope: AuthorizationScope): Promise<SupportAccessGrantState> => {
				if (!(await scope.supportTenants.exists(input.tenantId))) {
					throw new SupportAccessTenantNotFoundError();
				}
				const requested: SupportAccessGrantAggregate = SupportAccessGrantAggregate.request(
					{
						id: newRowId(),
						tenantId: input.tenantId,
						supportUserId: actor.userId,
						mode: input.mode,
						reason: input.reason,
						ticketRef: input.ticketRef ?? null,
						durationMinutes: input.durationMinutes,
					},
					this.clock.now(),
				);
				const stored: SupportAccessGrantState = await scope.supportGrants.add(requested);
				await scope.tenantAudit.record({
					tenantId: input.tenantId,
					actorUserId: actor.userId,
					action: SUPPORT_ACCESS_AUDIT_ACTIONS.requested,
					resourceType: SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE,
					resourceId: stored.id,
					metadata: { mode: input.mode, ticketRef: input.ticketRef ?? null, expiresAt: stored.expiresAt },
				});
				return stored;
			},
		);
		return {
			id: grant.id,
			tenantId: grant.tenantId,
			mode: grant.mode,
			status: grant.status,
			expiresAt: epochMs(grant.expiresAt),
			createdAt: epochMs(grant.createdAt),
		};
	}
}
