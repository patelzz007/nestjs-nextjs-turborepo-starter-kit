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
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { PolicyControlPlaneService } from "../services/policy-control-plane.service";

@ApiTags("Authorization Policies")
@Controller(apiPath("/policies"))
export class PolicyControlPlaneController {
	public constructor(private readonly policies: PolicyControlPlaneService) {}

	@Post("drafts")
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ZodResponse(PolicyDraftCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Policy draft created" })
	public async createDraft(@GetUser() user: AccessTokenPayload, @ZodBody(CreatePolicyDraftSchema) body: CreatePolicyDraftInput): Promise<PolicyDraftCreatedResponse> {
		return this.policies.createDraft(user.sub, null, body);
	}

	@Post("drafts/:draftId/simulate")
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ZodResponse(PolicySimulationResultSchema, { status: HttpStatus.CREATED, description: "Policy simulation result" })
	public async simulate(@GetUser() user: AccessTokenPayload, @ZodParam("draftId", UuidParamSchema) draftId: string): Promise<PolicySimulationResult> {
		return this.policies.simulate(draftId, user.sub);
	}

	@Post("publish")
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ZodResponse(PolicyPublishResponseSchema, { status: HttpStatus.CREATED, description: "Published policy version" })
	public async publish(@GetUser() user: AccessTokenPayload, @ZodBody(PolicyPublishRequestSchema) body: PolicyPublishRequestInput): Promise<PolicyPublishResponse> {
		return this.policies.publish(body.draftId, user.sub);
	}
}
