import { Controller, Get, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	NotificationDeliveryEntrySchema,
	NotificationProvidersResponseSchema,
	NotificationSuppressionEntrySchema,
	NotificationTypePreviewSchema,
	NotificationCatalogResponseSchema,
	OkResponseSchema,
	type NotificationDeliveryEntry,
	type NotificationDeliveryListQuery,
	type NotificationProvidersResponse,
	type NotificationSuppressionEntry,
	type NotificationSuppressionListQuery,
	type NotificationTypePreview,
	type NotificationTypeSummary,
	type OkResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { NOTIFICATION_ADMIN } from "../../application/ports/notifications.tokens";
import {
	NOTIFICATIONS_DELIVERY_LOG_OPERATION,
	NOTIFICATIONS_SUPPRESSIONS_OPERATION,
	type NotificationAdminService,
} from "../../application/services/notification-admin.service";

type Contract = typeof apiContract.notificationsAdmin;

/** Platform staff: every channel's delivery log, the catalog, suppressions and providers (ADR 070). */
@ApiTags("Notifications (admin)")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for notifications.")
@Controller(apiPath("/admin/notifications"))
export class NotificationsAdminController {
	public constructor(@Inject(NOTIFICATION_ADMIN) private readonly admin: NotificationAdminService) {}

	@RequirePermission("LIST", "NOTIFICATION")
	@PlatformOperation(NOTIFICATIONS_DELIVERY_LOG_OPERATION)
	@Get("deliveries")
	@ApiOperation({ summary: "Every delivery on every channel, newest first (masked destinations)" })
	@ZodPaginatedResponse(NotificationDeliveryEntrySchema, { description: "One page of deliveries" })
	public deliveries(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.notificationsAdmin.deliveries.input) query: NotificationDeliveryListQuery,
	): Promise<PaginatedServiceResult<NotificationDeliveryEntry>> {
		return this.admin.listDeliveries(actor, query);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "NOTIFICATION")
	@PlatformOperation(NOTIFICATIONS_DELIVERY_LOG_OPERATION)
	@Post("deliveries/:deliveryId/retry")
	@ApiOperation({ summary: "Queue a failed push or SMS delivery again (400 for any other)" })
	@ZodResponse(NotificationDeliveryEntrySchema, { status: HttpStatus.CREATED, description: "Queued again" })
	public retry(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.notificationsAdmin.retryDelivery.input) params: z.output<Contract["retryDelivery"]["input"]>,
	): Promise<NotificationDeliveryEntry> {
		return this.admin.retryDelivery(actor, params.deliveryId);
	}

	@RequirePermission("LIST", "NOTIFICATION")
	@Get("catalog")
	@ApiOperation({ summary: "Every notification type with its category, surfaces, channels and flags" })
	@ZodResponse(NotificationCatalogResponseSchema, { description: "The catalog" })
	public catalog(): NotificationTypeSummary[] {
		return [...this.admin.catalog()];
	}

	@RequirePermission("LIST", "NOTIFICATION")
	@Get("catalog/:key/preview")
	@ApiOperation({ summary: "How one type renders on every channel, with its sample payload" })
	@ZodResponse(NotificationTypePreviewSchema, { description: "Per-channel preview" })
	public preview(@ZodParams(apiContract.notificationsAdmin.previewType.input) params: z.output<Contract["previewType"]["input"]>): NotificationTypePreview {
		return this.admin.preview(params.key);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "NOTIFICATION")
	@Post("test")
	@ApiOperation({ summary: "Send yourself a test notification on every channel" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Requested" })
	public async sendTest(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.notificationsAdmin.sendTest.input) body: z.output<Contract["sendTest"]["input"]>,
	): Promise<OkResponse> {
		await this.admin.sendTest(actor, body.typeKey);
		return { ok: true };
	}

	@RequirePermission("LIST", "NOTIFICATION")
	@PlatformOperation(NOTIFICATIONS_SUPPRESSIONS_OPERATION)
	@Get("suppressions")
	@ApiOperation({ summary: "Addresses and numbers nothing is sent to (bounces, complaints, STOP, unsubscribes)" })
	@ZodPaginatedResponse(NotificationSuppressionEntrySchema, { description: "One page of suppressions" })
	public suppressions(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.notificationsAdmin.suppressions.input) query: NotificationSuppressionListQuery,
	): Promise<PaginatedServiceResult<NotificationSuppressionEntry>> {
		return this.admin.listSuppressions(actor, query);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "NOTIFICATION")
	@PlatformOperation(NOTIFICATIONS_SUPPRESSIONS_OPERATION)
	@Post("suppressions/:suppressionId/lift")
	@ApiOperation({ summary: "Lift a suppression, with a reason (audited)" })
	@ZodResponse(NotificationSuppressionEntrySchema, { status: HttpStatus.CREATED, description: "Lifted" })
	public lift(
		@CurrentActor() actor: ActorContext,
		@ZodParams(z.object({ suppressionId: z.uuid() }).strict()) params: { readonly suppressionId: string },
		@ZodBody(z.object({ reason: z.string().trim().min(10).max(500) }).strict()) body: { readonly reason: string },
	): Promise<NotificationSuppressionEntry> {
		return this.admin.liftSuppression(actor, params.suppressionId, body.reason);
	}

	@RequirePermission("LIST", "NOTIFICATION")
	@Get("providers")
	@ApiOperation({ summary: "Which provider each channel uses and whether it delivers for real" })
	@ZodResponse(NotificationProvidersResponseSchema, { description: "Providers" })
	public providers(): NotificationProvidersResponse {
		return this.admin.providerStatus();
	}
}
