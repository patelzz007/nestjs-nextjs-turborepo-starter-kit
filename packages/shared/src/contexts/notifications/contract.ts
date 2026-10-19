// API contract leaves owned by the `notifications` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { AdminMerchantInvitePreviewQuerySchema } from "../organizations/schemas/merchant";
import { emailRoutes, merchantInviteEmailPreviewRoutes } from "./routes";
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
