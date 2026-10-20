import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { PolicySimulationResult } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { AuthorizationPolicyDraftAggregate, type PolicyDraftState } from "../../../domain/aggregates/authorization-policy-draft.aggregate";
import { PolicyDraftNotFoundError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, POLICY_DRAFT_SIMULATE_OPERATION, POLICY_SIMULATOR } from "../../ports/authorization.tokens";
import { POLICY_AUDIT_ACTIONS, type PolicySimulationRun, type PolicySimulatorPort } from "../../ports/policy-control-plane.port";
import { SimulatePolicyDraftCommand } from "./simulate-policy-draft.command";
import { newRowId } from "@workspace/shared";

/**
 * D37: the draft load, every principal page, the stored result and its audit row run in ONE
 * `policy.draft.simulate` transaction (previously three separate system operations), so the result is
 * recorded against exactly the state it was computed from.
 */
@CommandHandler(SimulatePolicyDraftCommand)
export class SimulatePolicyDraftHandler implements ICommandHandler<SimulatePolicyDraftCommand, PolicySimulationResult> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(POLICY_SIMULATOR) private readonly simulator: PolicySimulatorPort,
	) {}

	public async execute(command: SimulatePolicyDraftCommand): Promise<PolicySimulationResult> {
		const { actor, policyActor, draftId } = command;
		AuthorizationPolicyDraftAggregate.assertActorMayChangePolicies(policyActor);
		return this.uow.runSystemOperation(POLICY_DRAFT_SIMULATE_OPERATION, actor, async (scope: AuthorizationScope): Promise<PolicySimulationResult> => {
			const draft: AuthorizationPolicyDraftAggregate | null = await scope.policyDrafts.findById(draftId);
			if (draft === null) {
				throw new PolicyDraftNotFoundError();
			}
			draft.assertSimulatable();
			const state: PolicyDraftState = draft.snapshot();
			const run: PolicySimulationRun = await this.simulator.simulate(state, scope.policyVersions, scope.policyPrincipals);
			const result: PolicySimulationResult = { simulationId: newRowId(), ...run.outcome };
			await scope.policySimulations.record({ id: result.simulationId, draftId, actorUserId: policyActor.userId, result, baselineFingerprint: run.baselineFingerprint });
			await scope.policyAudit.append({
				draftId,
				tenantId: state.tenantId,
				scope: state.scope,
				action: POLICY_AUDIT_ACTIONS.draftSimulated,
				actorUserId: policyActor.userId,
				policyVersionIds: [],
				details: {
					simulationId: result.simulationId,
					passed: result.passed,
					evaluatedPrincipalCount: result.evaluatedPrincipalCount,
					affectedPrincipalCount: result.affectedPrincipalCount,
				},
			});
			return result;
		});
	}
}
