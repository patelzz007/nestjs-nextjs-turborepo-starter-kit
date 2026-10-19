import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { PolicyDraftCreatedResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { ValidationError } from "../../../../../platform/application/errors/app-error";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { AuthorizationPolicyDraftAggregate } from "../../../domain/aggregates/authorization-policy-draft.aggregate";
import type { AuthorizationScope } from "../../authorization-scope";
import { AUTHORIZATION_UNIT_OF_WORK, POLICY_DRAFT_CREATE_OPERATION, POLICY_TEMPLATE_COMPILER } from "../../ports/authorization.tokens";
import { POLICY_AUDIT_ACTIONS, type CompiledPolicy, type PolicyCompilation, type PolicyTemplateCompilerPort } from "../../ports/policy-control-plane.port";
import { POLICY_ENGINE, type PolicyEngine, type PolicyValidationResult } from "../../ports/policy-engine.port";
import { CreatePolicyDraftCommand } from "./create-policy-draft.command";
import { newRowId } from "@workspace/shared";

/** Stable code clients match on when the builder payload or its compiled policy is rejected (400). */
export const POLICY_VALIDATION_FAILED_CODE = "POLICY_VALIDATION_FAILED";

/** The draft is rejected (400) before anything is stored when it does not compile or validate against the Cedar schema. */
@CommandHandler(CreatePolicyDraftCommand)
export class CreatePolicyDraftHandler implements ICommandHandler<CreatePolicyDraftCommand, PolicyDraftCreatedResponse> {
	public constructor(
		@Inject(AUTHORIZATION_UNIT_OF_WORK) private readonly uow: UnitOfWork<AuthorizationScope>,
		@Inject(POLICY_TEMPLATE_COMPILER) private readonly compiler: PolicyTemplateCompilerPort,
		@Inject(POLICY_ENGINE) private readonly engine: PolicyEngine,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CreatePolicyDraftCommand): Promise<PolicyDraftCreatedResponse> {
		const { actor, policyActor, input } = command;
		AuthorizationPolicyDraftAggregate.assertActorMayChangePolicies(policyActor);
		const organizationId: string | null = AuthorizationPolicyDraftAggregate.organizationFor(input.scope, input.organizationId ?? null);
		const compiled: CompiledPolicy = this.compileAndValidate(input.builderPayload, organizationId);

		return this.uow.runSystemOperation(POLICY_DRAFT_CREATE_OPERATION, actor, async (scope: AuthorizationScope): Promise<PolicyDraftCreatedResponse> => {
			const draft: AuthorizationPolicyDraftAggregate = AuthorizationPolicyDraftAggregate.create(
				{
					id: newRowId(),
					scope: input.scope,
					organizationId,
					name: input.name,
					description: input.description ?? null,
					builderPayload: input.builderPayload,
					cedarSource: compiled.cedarSource,
					sqlPredicate: compiled.sqlPredicate,
					createdById: policyActor.userId,
				},
				this.clock.now(),
			);
			await scope.policyDrafts.add(draft);
			await scope.policyAudit.append({
				draftId: draft.id,
				organizationId,
				scope: input.scope,
				action: POLICY_AUDIT_ACTIONS.draftCreated,
				actorUserId: policyActor.userId,
				policyVersionIds: [],
				details: { name: input.name },
			});
			return { draftId: draft.id };
		});
	}

	private compileAndValidate(payload: CreatePolicyDraftCommand["input"]["builderPayload"], organizationId: string | null): CompiledPolicy {
		const compilation: PolicyCompilation = this.compiler.compile(payload, organizationId);
		if (compilation.kind === "invalid") {
			throw new ValidationError({ code: POLICY_VALIDATION_FAILED_CODE, message: compilation.message });
		}
		const validation: PolicyValidationResult = this.engine.validate(compilation.policy.cedarSource);
		if (!validation.valid) {
			throw new ValidationError({
				code: POLICY_VALIDATION_FAILED_CODE,
				message: "The compiled policy does not validate against the tenant Cedar schema",
				details: { errors: [...validation.errors] },
			});
		}
		return compilation.policy;
	}
}
