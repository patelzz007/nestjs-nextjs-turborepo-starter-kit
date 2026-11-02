import { Controller, Delete, Get, HttpStatus, Inject, Patch, Post, Put, Sse, type MessageEvent } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	InAppNotificationResponseSchema,
	NotificationPreferencesResponseSchema,
	NotificationStreamQuerySchema,
	NotificationUnreadCountQuerySchema,
	NotificationUnreadCountResponseSchema,
	OkResponseSchema,
	PushDeviceListResponseSchema,
	PushDeviceResponseSchema,
	type InAppNotificationListQuery,
	type InAppNotificationResponse,
	type InAppNotificationSignal,
	type NotificationPreferencesResponse,
	type NotificationStreamQuery,
	type NotificationUnreadCountQuery,
	type NotificationUnreadCountResponse,
	type OkResponse,
	type PaginatedServiceResult,
	type PushDeviceResponse,
} from "@workspace/shared";
import { interval, map, merge, Observable } from "rxjs";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { self } from "../../../../platform/presentation/http/security/decorators/permission-target";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ApiEventStreamResponse } from "../../../../platform/presentation/http/validation/decorators/api-event-stream.decorator";
import { ZodBody, ZodListQuery, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { IN_APP_SIGNAL, type InAppSignalPort } from "../../application/ports/in-app-signal.port";
import { NOTIFICATION_ACCOUNT } from "../../application/ports/notifications.tokens";
import type { NotificationAccountService } from "../../application/services/notification-account.service";

/** A frame now and then keeps proxies from closing a quiet stream. */
export const NOTIFICATIONS_STREAM_KEEPALIVE_MS = 25_000;

const OWN = { resourceId: self(), description: "A person's own notifications" };

type Contract = typeof apiContract.notifications;

/** The signed-in person's own inbox, preferences and push devices (ADR 070), from any app. */
@ApiTags("Notifications")
@ApiBearerAuth()
@Controller(apiPath("/notifications"))
export class NotificationsController {
	public constructor(
		@Inject(NOTIFICATION_ACCOUNT) private readonly account: NotificationAccountService,
		@Inject(IN_APP_SIGNAL) private readonly signals: InAppSignalPort,
	) {}

	@RequirePermission("READ", "PROFILE", OWN)
	@Get()
	@ApiOperation({ summary: "The caller's inbox on one surface, newest first (`filter[readAt][isNull]=true` = unread)" })
	@ZodPaginatedResponse(InAppNotificationResponseSchema, { description: "One page of notifications; pagination is in `meta`" })
	public inbox(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.notifications.inbox.input) query: InAppNotificationListQuery,
	): Promise<PaginatedServiceResult<InAppNotificationResponse>> {
		return this.account.listInbox(actor, query);
	}

	@RequirePermission("READ", "PROFILE", OWN)
	@Get("unread-count")
	@ApiOperation({ summary: "How many notifications on one surface are unread (the bell badge)" })
	@ZodResponse(NotificationUnreadCountResponseSchema, { description: "Unread count" })
	public async unreadCount(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(NotificationUnreadCountQuerySchema) query: NotificationUnreadCountQuery,
	): Promise<NotificationUnreadCountResponse> {
		return { unread: await this.account.unreadCount(actor, query.surface) };
	}

	@RequirePermission("READ", "PROFILE", OWN)
	@Sse("stream")
	@ApiOperation({ summary: "The caller's inbox, live (SSE): a `{ surface, unread }` frame whenever it changes" })
	@ApiEventStreamResponse("A `{ surface, unread }` frame per change and a `ping` every 25 s (no envelope)")
	public stream(@CurrentActor() actor: ActorContext, @ZodQuery(NotificationStreamQuerySchema) query: NotificationStreamQuery): Observable<MessageEvent> {
		const userId = actor.kind === "user" ? actor.userId : "";
		const changes = new Observable<MessageEvent>((subscriber) =>
			this.signals.subscribe(userId, query.surface, (signal: InAppNotificationSignal): void => {
				subscriber.next({ data: signal });
			}),
		);
		return merge(changes, interval(NOTIFICATIONS_STREAM_KEEPALIVE_MS).pipe(map((): MessageEvent => ({ type: "ping", data: "" }))));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", OWN)
	@Post("read")
	@ApiOperation({ summary: "Mark notifications read (by id, or all on one surface); read everywhere, including the phone's tray" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Marked read" })
	public async read(@CurrentActor() actor: ActorContext, @ZodBody(apiContract.notifications.read.input) body: z.output<Contract["read"]["input"]>): Promise<OkResponse> {
		await this.account.markRead(actor, body);
		return { ok: true };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", OWN)
	@Post("archive")
	@ApiOperation({ summary: "Archive notifications (they leave the inbox; read too)" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Archived" })
	public async archive(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.notifications.archive.input) body: z.output<Contract["archive"]["input"]>,
	): Promise<OkResponse> {
		await this.account.archive(actor, body.notificationIds);
		return { ok: true };
	}

	@RequirePermission("READ", "PROFILE", OWN)
	@Get("preferences")
	@ApiOperation({ summary: "The preference matrix (category × channel), quiet hours, digest, consent and tenant links" })
	@ZodResponse(NotificationPreferencesResponseSchema, { description: "Preferences" })
	public preferences(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(apiContract.notifications.preferences.input) query: z.output<Contract["preferences"]["input"]>,
	): Promise<NotificationPreferencesResponse> {
		return this.account.preferences(actor, query.tenantId ?? null);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", OWN)
	@Put("preferences")
	@ApiOperation({ summary: "Turn categories on or off per channel, everywhere or for one tenant (mandatory channels refuse with 400)" })
	@ZodResponse(NotificationPreferencesResponseSchema, { description: "The preferences after the change" })
	public updatePreferences(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.notifications.updatePreferences.input) body: z.output<Contract["updatePreferences"]["input"]>,
	): Promise<NotificationPreferencesResponse> {
		return this.account.updatePreferences(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", OWN)
	@Patch("preferences")
	@ApiOperation({ summary: "Set quiet hours, the time zone and the email digest" })
	@ZodResponse(NotificationPreferencesResponseSchema, { description: "The preferences after the change" })
	public updateSchedule(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.notifications.updateSchedule.input) body: z.output<Contract["updateSchedule"]["input"]>,
	): Promise<NotificationPreferencesResponse> {
		return this.account.updateSchedule(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", OWN)
	@Post("consent")
	@ApiOperation({ summary: "Grant or withdraw marketing consent (the platform's, or one tenant's), recorded with its wording version" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Consent recorded" })
	public async consent(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.notifications.setConsent.input) body: z.output<Contract["setConsent"]["input"]>,
	): Promise<OkResponse> {
		await this.account.setConsent(actor, body);
		return { ok: true };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", OWN)
	@Post("leave-tenant")
	@ApiOperation({ summary: "Stop hearing from a tenant until claiming from it again (withdraws its consent)" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Left" })
	public async leaveTenant(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.notifications.leaveTenant.input) body: z.output<Contract["leaveTenant"]["input"]>,
	): Promise<OkResponse> {
		await this.account.leaveTenant(actor, body.tenantId);
		return { ok: true };
	}

	@RequirePermission("READ", "PROFILE", OWN)
	@Get("push-devices")
	@ApiOperation({ summary: "The caller's registered push devices" })
	@ZodResponse(PushDeviceListResponseSchema, { description: "Devices" })
	public async devices(@CurrentActor() actor: ActorContext): Promise<PushDeviceResponse[]> {
		return [...(await this.account.listDevices(actor))];
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", OWN)
	@Put("push-devices")
	@ApiOperation({ summary: "Register this app install for push (bound to the signed-in session); 503 when push is not configured" })
	@ZodResponse(PushDeviceResponseSchema, { description: "The registered device" })
	public registerDevice(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.notifications.registerPushDevice.input) body: z.output<Contract["registerPushDevice"]["input"]>,
	): Promise<PushDeviceResponse> {
		return this.account.registerDevice(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", OWN)
	@Delete("push-devices/:deviceId")
	@ApiOperation({ summary: "Remove one of the caller's push devices" })
	@ZodResponse(OkResponseSchema, { description: "Removed" })
	public async removeDevice(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.notifications.removePushDevice.input) params: z.output<Contract["removePushDevice"]["input"]>,
	): Promise<OkResponse> {
		await this.account.removeDevice(actor, params.deviceId);
		return { ok: true };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", OWN)
	@Post("push-opened")
	@ApiOperation({ summary: "A push was tapped: it is marked opened and read in every inbox" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Recorded" })
	public async pushOpened(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.notifications.pushOpened.input) body: z.output<Contract["pushOpened"]["input"]>,
	): Promise<OkResponse> {
		await this.account.pushOpened(actor, body.deliveryId);
		return { ok: true };
	}
}
