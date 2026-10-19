import { Controller, HttpStatus, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	CreatePolicyDraftSchema,
	PolicyDraftCreatedResponseSchema,
	PolicyPublishRequestSchema,
	PolicyPublishResponseSchema,
	PolicySimulationResultSchema,
	UuidParamSchema,
	type CreatePolicyDraftInput,
	type PolicyDraftCreatedResponse,
	type PolicyPublishRequestInput,
	type PolicyPublishResponse,
	type PolicySimulationResult,
	type AccessTokenPayload,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParam } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CreatePolicyDraftCommand } from "../../application/commands/create-policy-draft/create-policy-draft.command";
import { PublishPolicyCommand } from "../../application/commands/publish-policy/publish-policy.command";
import { SimulatePolicyDraftCommand } from "../../application/commands/simulate-policy-draft/simulate-policy-draft.command";
import type { PolicyControlPlaneActor } from "../../domain/aggregates/authorization-policy-draft.aggregate";

/** The control-plane actor of an access token; ANY impersonation marker counts as impersonating. */
export function policyActorOf(user: AccessTokenPayload): PolicyControlPlaneActor {
	return { userId: user.sub, isImpersonating: user.isImpersonating === true || user.originalUserId !== undefined };
}

/**
 * Authorization policy control plane. Platform SuperAdmins only (every route), on top of the
 * MANAGE:SYSTEM_SETTINGS permission; publishing additionally requires a SuperAdmin other than the author.
 */
@ApiTags("Authorization Policies")
@Controller(apiPath("/policies"))
export class PolicyControlPlaneController {
	public constructor(private readonly commandBus: CommandBus) {}

	@Post("drafts")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@SuperAdminOnly()
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ZodResponse(PolicyDraftCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Policy draft created" })
	public async createDraft(
		@CurrentActor() actor: ActorContext,
		@GetUser() user: AccessTokenPayload,
		@ZodBody(CreatePolicyDraftSchema) body: CreatePolicyDraftInput,
	): Promise<PolicyDraftCreatedResponse> {
		return this.commandBus.execute(new CreatePolicyDraftCommand(actor, policyActorOf(user), body));
	}

	@Post("drafts/:draftId/simulate")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@SuperAdminOnly()
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ZodResponse(PolicySimulationResultSchema, { status: HttpStatus.CREATED, description: "Policy simulation result" })
	public async simulate(
		@CurrentActor() actor: ActorContext,
		@GetUser() user: AccessTokenPayload,
		@ZodParam("draftId", UuidParamSchema) draftId: string,
	): Promise<PolicySimulationResult> {
		return this.commandBus.execute(new SimulatePolicyDraftCommand(actor, policyActorOf(user), draftId));
	}

	@Post("publish")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@SuperAdminOnly()
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ZodResponse(PolicyPublishResponseSchema, { status: HttpStatus.CREATED, description: "Published policy version (approved by a second SuperAdmin)" })
	public async publish(
		@CurrentActor() actor: ActorContext,
		@GetUser() user: AccessTokenPayload,
		@ZodBody(PolicyPublishRequestSchema) body: PolicyPublishRequestInput,
	): Promise<PolicyPublishResponse> {
		return this.commandBus.execute(new PublishPolicyCommand(actor, policyActorOf(user), { draftId: body.draftId, approvalNote: body.approvalNote }));
	}
}
