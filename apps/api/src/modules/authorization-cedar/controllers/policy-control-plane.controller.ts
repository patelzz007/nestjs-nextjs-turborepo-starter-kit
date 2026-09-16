import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	CreatePolicyDraftSchema,
	PolicyPublishRequestSchema,
	type CreatePolicyDraftInput,
	type PolicyPublishRequestInput,
	type PolicySimulationResult,
} from "@workspace/shared";

import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { PolicyControlPlaneService } from "../services/policy-control-plane.service";

@ApiTags("Authorization Policies")
@Controller(apiPath("/policies"))
export class PolicyControlPlaneController {
	public constructor(
		private readonly policies: PolicyControlPlaneService,
	) {}

	@Post("drafts")
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ApiOkResponse({ description: "Policy draft created" })
	public async createDraft(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(CreatePolicyDraftSchema)) body: CreatePolicyDraftInput,
	): Promise<{ draftId: string }> {
	}

	@Post("drafts/:draftId/simulate")
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ApiOkResponse({ description: "Policy simulation result" })
	public async simulate(@GetUser() user: AccessTokenPayload, @Param("draftId") draftId: string): Promise<PolicySimulationResult> {
		return this.policies.simulate(draftId, user.sub);
	}

	@Post("publish")
	@RequirePermission("MANAGE", "SYSTEM_SETTINGS")
	@ApiOkResponse({ description: "Published policy version" })
	public async publish(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(PolicyPublishRequestSchema)) body: PolicyPublishRequestInput,
	): Promise<{ version: number }> {
	}
}
