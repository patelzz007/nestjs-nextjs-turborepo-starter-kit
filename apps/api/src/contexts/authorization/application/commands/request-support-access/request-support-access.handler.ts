import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, newRowId, type SupportAccessGrantResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { SupportAccessGrantAggregate, type SupportAccessGrantState } from "../../../domain/aggregates/support-access-grant.aggregate";
import { SupportAccessOrganizationNotFoundError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, CEDAR_POLICY_EVALUATOR, SUPPORT_ACCESS_GRANT_OPERATION } from "../../ports/authorization.tokens";
import type { CedarPolicyEvaluatorPort } from "../../ports/cedar-policy-evaluator.port";
import { requireUserActor } from "../../services/rbac-actor";
import { SUPPORT_ACCESS_AUDIT_ACTIONS, SUPPORT_ACCESS_AUDIT_RESOURCE_TYPE } from "../../services/support-access-audit";
import { RequestSupportAccessCommand } from "./request-support-access.command";

/** The grant and its organization audit row (real actor + active policy version) commit together under `support_access.grant`. */
@CommandHandler(RequestSupportAccessCommand)
export class RequestSupportAccessHandler implements ICommandHandler<RequestSupportAccessCommand, SupportAccessGrantResponse> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(CEDAR_POLICY_EVALUATOR) private readonly cedar: CedarPolicyEvaluatorPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestSupportAccessCommand): Promise<SupportAccessGrantResponse> {
		const { input } = command;
		const actor = requireUserActor(command.actor);
		const policyVersion: number = await this.cedar.getActivePolicyVersion(input.organizationId);
		const grant: SupportAccessGrantState = await this.uow.runSystemOperation(
			SUPPORT_ACCESS_GRANT_OPERATION,
			actor,
			async (scope: AuthorizationScope): Promise<SupportAccessGrantState> => {
				if (!(await scope.supportOrganizations.exists(input.organizationId))) {
					throw new SupportAccessOrganizationNotFoundError();
				}
				const requested: SupportAccessGrantAggregate = SupportAccessGrantAggregate.request(
					{
						id: newRowId(),
						organizationId: input.organizationId,
						supportUserId: actor.userId,
						mode: input.mode,
						reason: input.reason,
						ticketRef: input.ticketRef ?? null,
						durationMinutes: input.durationMinutes,
					},
					this.clock.now(),
				);
				const stored: SupportAccessGrantState = await scope.supportGrants.add(requested);
				await scope.organizationAudit.record({
					organizationId: input.organizationId,
					actorUserId: actor.userId,
					policyVersion,
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
			organizationId: grant.organizationId,
			mode: grant.mode,
			status: grant.status,
			expiresAt: epochMs(grant.expiresAt),
			createdAt: epochMs(grant.createdAt),
		};
	}
}
