import { createHash } from "node:crypto";

import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, PolicyPublishResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { AuthorizationPolicyDraftAggregate, type PolicyDraftState, type PolicySlot } from "../../../domain/aggregates/authorization-policy-draft.aggregate";
import { PolicyDraftNotFoundError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, POLICY_PUBLISH_OPERATION, POLICY_SIMULATOR } from "../../ports/authorization.tokens";
import { POLICY_AUDIT_ACTIONS, type PolicySimulatorPort } from "../../ports/policy-control-plane.port";
import { PublishPolicyCommand } from "./publish-policy.command";

/**
 * One `policy.publish` transaction: the slot's advisory locks, the draft re-read under them, the
 * four-eyes and simulation rules (domain), the compared-and-set claim, the next version computed under
 * the lock (also enforced by unique indexes), the superseded predecessor and the audit row.
 * `PolicyPublished` drops the stale bundles on every instance after commit.
 */
@CommandHandler(PublishPolicyCommand)
export class PublishPolicyHandler implements ICommandHandler<PublishPolicyCommand, PolicyPublishResponse> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(POLICY_SIMULATOR) private readonly simulator: PolicySimulatorPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: PublishPolicyCommand): Promise<PolicyPublishResponse> {
		const { actor, policyActor, input } = command;
		AuthorizationPolicyDraftAggregate.assertActorMayChangePolicies(policyActor);
		const approverUserId: string = policyActor.userId;
		return this.uow.runSystemOperation(POLICY_PUBLISH_OPERATION, actor, async (scope: AuthorizationScope): Promise<PolicyPublishResponse> => {
			const found: AuthorizationPolicyDraftAggregate = requireDraft(await scope.policyDrafts.findById(input.draftId));
			found.assertApprovableBy(approverUserId);
			const slot: PolicySlot = found.slot;
			await scope.policyVersions.lockSlotForPublish(slot);

			// Re-read under the lock: a publish that committed first now shows as no longer a draft.
			const draft: AuthorizationPolicyDraftAggregate = requireDraft(await scope.policyDrafts.findById(input.draftId));
			const now: EpochMs = this.clock.now();
			const version: number = (await scope.policyVersions.maxVersion(slot)) + 1;
			draft.publish(
				approverUserId,
				version,
				await scope.policySimulations.latestFor(input.draftId),
				await this.simulator.currentBaselineFingerprint(slot, scope.policyVersions),
				now,
			);
			await scope.policyDrafts.savePublished(draft);

			const state: PolicyDraftState = draft.snapshot();
			await scope.policyVersions.supersedeActive(slot, now);
			const created = await scope.policyVersions.create({
				...slot,
				draftId: input.draftId,
				version,
				cedarSource: state.cedarSource,
				sqlPredicate: state.sqlPredicate,
				contentHash: createHash("sha256").update(state.cedarSource).digest("hex"),
				publishedAt: now,
				publishedById: approverUserId,
			});
			await scope.policyAudit.append({
				draftId: input.draftId,
				organizationId: state.organizationId,
				scope: state.scope,
				action: POLICY_AUDIT_ACTIONS.draftPublished,
				actorUserId: approverUserId,
				policyVersionIds: [created.id],
				details: { version, authorUserId: state.createdById, approverUserId, approvalNote: input.approvalNote ?? null },
			});
			scope.events.collectFrom(draft);
			return { version: created.version };
		});
	}
}

function requireDraft(draft: AuthorizationPolicyDraftAggregate | null): AuthorizationPolicyDraftAggregate {
	if (draft === null) {
		throw new PolicyDraftNotFoundError();
	}
	return draft;
}
