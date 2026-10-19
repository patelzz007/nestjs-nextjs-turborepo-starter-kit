import { Controller, HttpStatus, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import {
	AdminCreateOrganizationInviteSchema,
	AdminOrganizationInviteCreatedResponseSchema,
	apiPath,
	type AdminCreateOrganizationInviteInput,
	type AdminOrganizationInviteCreatedResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { Idempotent } from "../../../../platform/presentation/http/idempotency/idempotent.decorator";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ProvisionOrganizationFromPlatformInviteCommand } from "../../application/commands/provision-organization-from-platform-invite/provision-organization-from-platform-invite.command";

@ApiTags("Organizations")
@Controller(apiPath("/admin/organizations"))
export class OrganizationAdminController {
	public constructor(private readonly commandBus: CommandBus) {}

	/** Each call mints a new token, so a retry must replay the first response: clients send an `Idempotency-Key` (D24). */
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Idempotent()
	@Post("invites")
	@SuperAdminOnly()
	@RequirePermission("CREATE", "MERCHANT_ORG")
	@ZodResponse(AdminOrganizationInviteCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Organization invite created" })
	public createInvite(
		@CurrentActor() actor: ActorContext,
		@ZodBody(AdminCreateOrganizationInviteSchema) body: AdminCreateOrganizationInviteInput,
	): Promise<AdminOrganizationInviteCreatedResponse> {
		return this.commandBus.execute(new ProvisionOrganizationFromPlatformInviteCommand(actor, body));
	}
}
