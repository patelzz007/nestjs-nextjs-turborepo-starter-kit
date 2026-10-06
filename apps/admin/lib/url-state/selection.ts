// In-page selection on list/queue pages lives in the query string (lib/routes.ts
// conventions; ADR 023): the selection is shareable, survives a reload, and
// back/forward moves between selections — with the URL as the only copy.

import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";
import { AdminLocationRequestResponseSchema, EmailTemplateKeySchema, HttpAuditLogSummarySchema, MerchantOrgResponseSchema } from "@workspace/shared";

import { AUDIT_LOG_RECORD_PARAM, EMAIL_TEMPLATE_KEY_PARAM, MERCHANT_VERIFICATION_ORGANIZATION_PARAM, REVIEW_REQUEST_PARAM } from "@/lib/routes";

/** `/merchants/verification?organizationId=` — the merchant open in the KYB review panel. */
export const KYB_REVIEW_URL_STATE = defineUrlState(
	{ organizationId: optionalUrlParam(MerchantOrgResponseSchema.shape.id) },
	{ urlKeys: { organizationId: MERCHANT_VERIFICATION_ORGANIZATION_PARAM } },
);

export type KybReviewUrlState = typeof KYB_REVIEW_URL_STATE.defaults;

/** `/emails/templates?key=` — the template open in the preview. */
export const EMAIL_TEMPLATES_URL_STATE = defineUrlState({ key: optionalUrlParam(EmailTemplateKeySchema) }, { urlKeys: { key: EMAIL_TEMPLATE_KEY_PARAM } });

export type EmailTemplatesUrlState = typeof EMAIL_TEMPLATES_URL_STATE.defaults;

/** `/merchants/store-requests?requestId=` — the store location request open in the review panel. */
export const STORE_REQUESTS_URL_STATE = defineUrlState(
	{ requestId: optionalUrlParam(AdminLocationRequestResponseSchema.shape.id) },
	{ urlKeys: { requestId: REVIEW_REQUEST_PARAM } },
);

export type StoreRequestsUrlState = typeof STORE_REQUESTS_URL_STATE.defaults;

/** `/audit-logs?record=` — the audit record open in the drawer (kept apart from the table state, so opening one never resets paging). */
export const AUDIT_LOG_RECORD_URL_STATE = defineUrlState({ record: optionalUrlParam(HttpAuditLogSummarySchema.shape.id) }, { urlKeys: { record: AUDIT_LOG_RECORD_PARAM } });

export type AuditLogRecordUrlState = typeof AUDIT_LOG_RECORD_URL_STATE.defaults;
