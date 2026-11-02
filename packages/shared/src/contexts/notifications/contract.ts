// API contract leaves owned by the `notifications` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { AdminMerchantInvitePreviewQuerySchema } from "../tenancy/schemas/merchant";
import { OkResponseSchema } from "../../schemas/api/message";
import { TenantSlugParamSchema } from "../tenancy/schemas/tenant";
import { broadcastReportRoutes, emailRoutes, merchantInviteEmailPreviewRoutes, notificationsAdminRoutes, notificationsRoutes, tenantNotificationsRoutes } from "./routes";
import {
	BroadcastAudiencePreviewSchema,
	TenantBroadcastAudienceSchema,
	TenantCustomerEntrySchema,
	TenantCustomerListQuerySchema,
	BroadcastAudienceSchema,
	BroadcastDraftSchema,
	BroadcastIdParamsSchema,
	BroadcastListQuerySchema,
	BroadcastReportEntrySchema,
	BroadcastReportListQuerySchema,
	BroadcastResponseSchema,
	BroadcastWeeklyAllowanceSchema,
	ReportBroadcastSchema,
	ReviewBroadcastReportSchema,
} from "./schemas/broadcasts";
import {
	ArchiveNotificationsSchema,
	InAppNotificationListQuerySchema,
	InAppNotificationResponseSchema,
	LeaveTenantSchema,
	LiftNotificationSuppressionSchema,
	MarkNotificationsReadSchema,
	NotificationDeliveryEntrySchema,
	NotificationDeliveryListQuerySchema,
	NotificationPreferencesQuerySchema,
	NotificationPreferencesResponseSchema,
	NotificationProvidersResponseSchema,
	NotificationScheduleSchema,
	NotificationSuppressionEntrySchema,
	NotificationSuppressionListQuerySchema,
	NotificationTypeKeyParamsSchema,
	NotificationTypePreviewSchema,
	NotificationCatalogResponseSchema,
	NotificationUnreadCountQuerySchema,
	NotificationUnreadCountResponseSchema,
	PushDeviceListResponseSchema,
	PushDeviceResponseSchema,
	PushOpenedSchema,
	RegisterPushDeviceSchema,
	SendTestNotificationSchema,
	SetMarketingConsentSchema,
	UnsubscribeBodySchema,
	UnsubscribeResponseSchema,
	UpdateNotificationPreferencesSchema,
} from "./schemas/notifications";
import { EmailLogEntrySchema, EmailLogListQuerySchema, EmailPreviewListResponseSchema, EmailPreviewSchema, EmailSendResultSchema } from "./schemas/email";

// ── Email templates & delivery logs ────────────────────────────────
// Preview email templates (admin-only), send test emails, and
// query the delivery log. Uses Resend for actual sending.

/** Contract leaves composed into `apiContract.email`. */
export const emailContract = {
	previewList: defineContract({ method: "GET", path: emailRoutes.previewList, input: z.undefined(), response: singleResponse(EmailPreviewListResponseSchema) }),
	/** Preview detail for one template key. */
	previewDetail: defineContract({
		method: "GET",
		path: emailRoutes.previewDetail,
		input: z.object({ key: z.string() }).strict(),
		response: singleResponse(EmailPreviewSchema),
	}),
	/** Sends one template to the configured test address. */
	previewSend: defineContract({
		method: "POST",
		path: emailRoutes.previewSend,
		input: z.object({ key: z.string() }).strict(),
		response: singleResponse(EmailSendResultSchema),
	}),
	logList: defineContract({ method: "GET", path: emailRoutes.logList, input: EmailLogListQuerySchema, response: paginatedResponse(EmailLogEntrySchema) }),
};

/** Contract leaves composed into `apiContract.rewardsAdmin` (previewInviteEmail). */
export const merchantInviteEmailPreviewContract = {
	/** Renders the invite email from the form as the admin types — a safe read, so it is a GET and never audited as a change. */
	previewInviteEmail: defineContract({
		method: "GET",
		path: merchantInviteEmailPreviewRoutes.invitesPreviewEmail,
		input: AdminMerchantInvitePreviewQuerySchema,
		response: singleResponse(EmailPreviewSchema),
	}),
};

// ── Notifications (ADR 070) ─────────────────────────────────────────

const DeviceIdParamsSchema = z.object({ deviceId: z.uuid() }).strict();
const DeliveryIdParamsSchema = z.object({ deliveryId: z.uuid() }).strict();
const SuppressionIdParamsSchema = z.object({ suppressionId: z.uuid() }).strict();
const ReportIdParamsSchema = z.object({ reportId: z.uuid() }).strict();

/** Contract leaves composed into `apiContract.notifications`: the caller's own inbox, preferences and devices. */
export const notificationsContract = {
	inbox: defineContract({
		method: "GET",
		path: notificationsRoutes.inbox,
		input: InAppNotificationListQuerySchema,
		response: paginatedResponse(InAppNotificationResponseSchema),
	}),
	unreadCount: defineContract({
		method: "GET",
		path: notificationsRoutes.unreadCount,
		input: NotificationUnreadCountQuerySchema,
		response: singleResponse(NotificationUnreadCountResponseSchema),
	}),
	read: defineContract({ method: "POST", path: notificationsRoutes.read, input: MarkNotificationsReadSchema, response: singleResponse(OkResponseSchema) }),
	archive: defineContract({ method: "POST", path: notificationsRoutes.archive, input: ArchiveNotificationsSchema, response: singleResponse(OkResponseSchema) }),
	preferences: defineContract({
		method: "GET",
		path: notificationsRoutes.preferences,
		input: NotificationPreferencesQuerySchema,
		response: singleResponse(NotificationPreferencesResponseSchema),
	}),
	updatePreferences: defineContract({
		method: "PUT",
		path: notificationsRoutes.preferences,
		input: UpdateNotificationPreferencesSchema,
		response: singleResponse(NotificationPreferencesResponseSchema),
	}),
	updateSchedule: defineContract({
		method: "PATCH",
		path: notificationsRoutes.preferences,
		input: NotificationScheduleSchema,
		response: singleResponse(NotificationPreferencesResponseSchema),
	}),
	setConsent: defineContract({ method: "POST", path: notificationsRoutes.consent, input: SetMarketingConsentSchema, response: singleResponse(OkResponseSchema) }),
	leaveTenant: defineContract({ method: "POST", path: notificationsRoutes.leaveTenant, input: LeaveTenantSchema, response: singleResponse(OkResponseSchema) }),
	pushDevices: defineContract({ method: "GET", path: notificationsRoutes.pushDevices, input: z.undefined(), response: singleResponse(PushDeviceListResponseSchema) }),
	registerPushDevice: defineContract({
		method: "PUT",
		path: notificationsRoutes.pushDevices,
		input: RegisterPushDeviceSchema,
		response: singleResponse(PushDeviceResponseSchema),
	}),
	removePushDevice: defineContract({ method: "DELETE", path: notificationsRoutes.pushDevice, input: DeviceIdParamsSchema, response: singleResponse(OkResponseSchema) }),
	pushOpened: defineContract({ method: "POST", path: notificationsRoutes.pushOpened, input: PushOpenedSchema, response: singleResponse(OkResponseSchema) }),
	unsubscribe: defineContract({
		access: "public",
		method: "POST",
		path: notificationsRoutes.unsubscribe,
		input: UnsubscribeBodySchema,
		response: singleResponse(UnsubscribeResponseSchema),
	}),
	reportBroadcast: defineContract({
		method: "POST",
		path: broadcastReportRoutes.report,
		input: z.intersection(BroadcastIdParamsSchema, ReportBroadcastSchema),
		response: singleResponse(OkResponseSchema),
	}),
};

/** Contract leaves composed into `apiContract.notificationsAdmin`: platform staff. */
export const notificationsAdminContract = {
	deliveries: defineContract({
		method: "GET",
		path: notificationsAdminRoutes.deliveries,
		input: NotificationDeliveryListQuerySchema,
		response: paginatedResponse(NotificationDeliveryEntrySchema),
	}),
	retryDelivery: defineContract({
		method: "POST",
		path: notificationsAdminRoutes.retryDelivery,
		input: DeliveryIdParamsSchema,
		response: singleResponse(NotificationDeliveryEntrySchema),
	}),
	catalog: defineContract({ method: "GET", path: notificationsAdminRoutes.catalog, input: z.undefined(), response: singleResponse(NotificationCatalogResponseSchema) }),
	previewType: defineContract({
		method: "GET",
		path: notificationsAdminRoutes.previewType,
		input: NotificationTypeKeyParamsSchema,
		response: singleResponse(NotificationTypePreviewSchema),
	}),
	sendTest: defineContract({ method: "POST", path: notificationsAdminRoutes.sendTest, input: SendTestNotificationSchema, response: singleResponse(OkResponseSchema) }),
	suppressions: defineContract({
		method: "GET",
		path: notificationsAdminRoutes.suppressions,
		input: NotificationSuppressionListQuerySchema,
		response: paginatedResponse(NotificationSuppressionEntrySchema),
	}),
	liftSuppression: defineContract({
		method: "POST",
		path: notificationsAdminRoutes.liftSuppression,
		input: z.intersection(SuppressionIdParamsSchema, LiftNotificationSuppressionSchema),
		response: singleResponse(NotificationSuppressionEntrySchema),
	}),
	providers: defineContract({ method: "GET", path: notificationsAdminRoutes.providers, input: z.undefined(), response: singleResponse(NotificationProvidersResponseSchema) }),
	broadcasts: defineContract({
		method: "GET",
		path: notificationsAdminRoutes.broadcasts,
		input: BroadcastListQuerySchema,
		response: paginatedResponse(BroadcastResponseSchema),
	}),
	broadcast: defineContract({ method: "GET", path: notificationsAdminRoutes.broadcast, input: BroadcastIdParamsSchema, response: singleResponse(BroadcastResponseSchema) }),
	createBroadcast: defineContract({
		method: "POST",
		path: notificationsAdminRoutes.broadcasts,
		input: BroadcastDraftSchema,
		response: singleResponse(BroadcastResponseSchema),
	}),
	updateBroadcast: defineContract({
		method: "PUT",
		path: notificationsAdminRoutes.broadcast,
		input: z.intersection(BroadcastIdParamsSchema, BroadcastDraftSchema),
		response: singleResponse(BroadcastResponseSchema),
	}),
	scheduleBroadcast: defineContract({
		method: "POST",
		path: notificationsAdminRoutes.scheduleBroadcast,
		input: BroadcastIdParamsSchema,
		response: singleResponse(BroadcastResponseSchema),
	}),
	approveBroadcast: defineContract({
		method: "POST",
		path: notificationsAdminRoutes.approveBroadcast,
		input: BroadcastIdParamsSchema,
		response: singleResponse(BroadcastResponseSchema),
	}),
	cancelBroadcast: defineContract({
		method: "POST",
		path: notificationsAdminRoutes.cancelBroadcast,
		input: BroadcastIdParamsSchema,
		response: singleResponse(BroadcastResponseSchema),
	}),
	broadcastAudiencePreview: defineContract({
		method: "POST",
		path: notificationsAdminRoutes.broadcastAudiencePreview,
		input: BroadcastAudienceSchema,
		response: singleResponse(BroadcastAudiencePreviewSchema),
	}),
	broadcastReports: defineContract({
		method: "GET",
		path: notificationsAdminRoutes.broadcastReports,
		input: BroadcastReportListQuerySchema,
		response: paginatedResponse(BroadcastReportEntrySchema),
	}),
	reviewBroadcastReport: defineContract({
		method: "POST",
		path: notificationsAdminRoutes.reviewBroadcastReport,
		input: z.intersection(ReportIdParamsSchema, ReviewBroadcastReportSchema),
		response: singleResponse(OkResponseSchema),
	}),
};

/** Contract leaves composed into `apiContract.tenantNotifications`: a tenant's deliveries and broadcasts (ADR 073). */
export const tenantNotificationsContract = {
	deliveries: defineContract({
		method: "GET",
		path: tenantNotificationsRoutes.deliveries,
		input: z.intersection(TenantSlugParamSchema, NotificationDeliveryListQuerySchema),
		response: paginatedResponse(NotificationDeliveryEntrySchema),
	}),
	broadcasts: defineContract({
		method: "GET",
		path: tenantNotificationsRoutes.broadcasts,
		input: z.intersection(TenantSlugParamSchema, BroadcastListQuerySchema),
		response: paginatedResponse(BroadcastResponseSchema),
	}),
	broadcast: defineContract({
		method: "GET",
		path: tenantNotificationsRoutes.broadcast,
		input: z.intersection(TenantSlugParamSchema, BroadcastIdParamsSchema),
		response: singleResponse(BroadcastResponseSchema),
	}),
	createBroadcast: defineContract({
		method: "POST",
		path: tenantNotificationsRoutes.broadcasts,
		input: z.intersection(TenantSlugParamSchema, BroadcastDraftSchema),
		response: singleResponse(BroadcastResponseSchema),
	}),
	updateBroadcast: defineContract({
		method: "PUT",
		path: tenantNotificationsRoutes.broadcast,
		input: z.intersection(z.intersection(TenantSlugParamSchema, BroadcastIdParamsSchema), BroadcastDraftSchema),
		response: singleResponse(BroadcastResponseSchema),
	}),
	scheduleBroadcast: defineContract({
		method: "POST",
		path: tenantNotificationsRoutes.scheduleBroadcast,
		input: z.intersection(TenantSlugParamSchema, BroadcastIdParamsSchema),
		response: singleResponse(BroadcastResponseSchema),
	}),
	cancelBroadcast: defineContract({
		method: "POST",
		path: tenantNotificationsRoutes.cancelBroadcast,
		input: z.intersection(TenantSlugParamSchema, BroadcastIdParamsSchema),
		response: singleResponse(BroadcastResponseSchema),
	}),
	broadcastAudiencePreview: defineContract({
		method: "POST",
		path: tenantNotificationsRoutes.broadcastAudiencePreview,
		input: z.intersection(TenantSlugParamSchema, TenantBroadcastAudienceSchema),
		response: singleResponse(BroadcastAudiencePreviewSchema),
	}),
	broadcastAllowance: defineContract({
		method: "GET",
		path: tenantNotificationsRoutes.broadcastAllowance,
		input: TenantSlugParamSchema,
		response: singleResponse(BroadcastWeeklyAllowanceSchema),
	}),
	broadcastCustomers: defineContract({
		method: "GET",
		path: tenantNotificationsRoutes.broadcastCustomers,
		input: z.intersection(TenantSlugParamSchema, TenantCustomerListQuerySchema),
		response: paginatedResponse(TenantCustomerEntrySchema),
	}),
};
