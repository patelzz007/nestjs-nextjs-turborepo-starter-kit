import { Controller, HttpStatus, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import {
	AdminCreateTenantInviteSchema,
	AdminTenantInviteCreatedResponseSchema,
	apiPath,
	type AdminCreateTenantInviteInput,
	type AdminTenantInviteCreatedResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { Idempotent } from "../../../../platform/presentation/http/idempotency/idempotent.decorator";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ProvisionTenantFromPlatformInviteCommand } from "../../application/commands/provision-tenant-from-platform-invite/provision-tenant-from-platform-invite.command";
import { PROVISION_PLATFORM_INVITE_OPERATION } from "../../application/ports/tenants.tokens";

@ApiTags("Tenants")
@Controller(apiPath("/admin/tenants"))
export class TenantAdminController {
	public constructor(private readonly commandBus: CommandBus) {}

	/** Each call mints a new token, so a retry must replay the first response: clients send an `Idempotency-Key` (D24). */
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Idempotent()
	@Post("invites")
	@SuperAdminOnly()
	@RequirePermission("CREATE", "MERCHANT_ORG")
	@ZodResponse(AdminTenantInviteCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Tenant invite created" })
	@PlatformOperation(PROVISION_PLATFORM_INVITE_OPERATION)
	public createInvite(
		@CurrentActor() actor: ActorContext,
		@ZodBody(AdminCreateTenantInviteSchema) body: AdminCreateTenantInviteInput,
	): Promise<AdminTenantInviteCreatedResponse> {
		return this.commandBus.execute(new ProvisionTenantFromPlatformInviteCommand(actor, body));
	}
}
