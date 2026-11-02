import { Controller, Get, Inject, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	NotificationDeliveryEntrySchema,
	NotificationDeliveryListQuerySchema,
	TenantSlugParamSchema,
	type NotificationDeliveryEntry,
	type NotificationDeliveryListQuery,
	type PaginatedServiceResult,
} from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { NOTIFICATION_ADMIN } from "../../application/ports/notifications.tokens";
import type { NotificationAdminService } from "../../application/services/notification-admin.service";

/** A tenant's own delivery log (ADR 070): the route's tenant only, no retry. `merchant:view_notifications`. */
@ApiTags("Notifications (tenant)")
@ApiBearerAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/tenants/:tenantSlug/notifications"))
export class TenantNotificationsController {
	public constructor(@Inject(NOTIFICATION_ADMIN) private readonly admin: NotificationAdminService) {}

	@Get("deliveries")
	@ApiOperation({ summary: "The tenant's deliveries, newest first (masked destinations)" })
	@ZodPaginatedResponse(NotificationDeliveryEntrySchema, { description: "One page of the tenant's deliveries; pagination is in `meta`" })
	public deliveries(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodListQuery(NotificationDeliveryListQuerySchema) query: NotificationDeliveryListQuery,
	): Promise<PaginatedServiceResult<NotificationDeliveryEntry>> {
		return this.admin.listTenantDeliveries(actor, merchant.tenantId, query);
	}
}
