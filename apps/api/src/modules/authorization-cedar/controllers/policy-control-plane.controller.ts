import { Controller, HttpStatus, Post } from "@nestjs/common";
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
} from "@workspace/shared";

import { ZodBody, ZodParam } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../../auth/decorators/super-admin.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { PolicyControlPlaneService, type PolicyControlPlaneActor } from "../services/policy-control-plane.service";

/** The control-plane actor of an access token; any impersonation marker counts as impersonating. */
export function policyActorOf(user: AccessTokenPayload): PolicyControlPlaneActor {
	return { userId: user.sub, isImpersonating: user.isImpersonating === true || user.originalUserId !== undefined };
}

/**
 * Authorization policy control plane. Platform SuperAdmins only (every
 * route), on top of the MANAGE:SYSTEM_SETTINGS permission; publishing
 * additionally requires a SuperAdmin other than the draft's author.
 */
@ApiTags("Authorization Policies")
@Controller(apiPath("/policies"))
export class PolicyControlPlaneController {
	public constructor(private readonly policies: PolicyControlPlaneService) {}

	@Post("drafts")
	@SuperAdminOnly()
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ZodResponse(PolicyDraftCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Policy draft created" })
	public async createDraft(@GetUser() user: AccessTokenPayload, @ZodBody(CreatePolicyDraftSchema) body: CreatePolicyDraftInput): Promise<PolicyDraftCreatedResponse> {
		return this.policies.createDraft(policyActorOf(user), body);
	}

	@Post("drafts/:draftId/simulate")
	@SuperAdminOnly()
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ZodResponse(PolicySimulationResultSchema, { status: HttpStatus.CREATED, description: "Policy simulation result" })
	public async simulate(@GetUser() user: AccessTokenPayload, @ZodParam("draftId", UuidParamSchema) draftId: string): Promise<PolicySimulationResult> {
		return this.policies.simulate(draftId, policyActorOf(user));
	}

	@Post("publish")
	@SuperAdminOnly()
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ZodResponse(PolicyPublishResponseSchema, { status: HttpStatus.CREATED, description: "Published policy version (approved by a second SuperAdmin)" })
	public async publish(@GetUser() user: AccessTokenPayload, @ZodBody(PolicyPublishRequestSchema) body: PolicyPublishRequestInput): Promise<PolicyPublishResponse> {
		return this.policies.publish(body.draftId, policyActorOf(user), body.approvalNote);
	}
}
