// ============================================
// lib/data-table/enum-filter-options.ts - table filter options from a shared enum
// ============================================
// A filter's options are the shared zod enum's `options`, each labelled from a
// `Record<Value, string>` — the compiler then rejects a label table that
// misses a value, so adding a status to the enum can never leave a filter
// silently without it (the KYB filter once lacked ACTION_REQUIRED).

import type {
	AdminUserStatus,
	AuditAuthMethod,
	AuditHttpMethod,
	AuditOutcome,
	DeviceType,
	EmailLogStatus,
	IpAddressScope,
	KybStatus,
	MerchantOrgStatus,
} from "@workspace/shared";

/** One option of a data-table select filter. */
export interface EnumFilterOption<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
}

/** `values` (a shared enum's `Schema.options`) in their order, labelled from `labels`. */
export function enumFilterOptions<TValue extends string>(values: readonly TValue[], labels: Readonly<Record<TValue, string>>): EnumFilterOption<TValue>[] {
	return values.map((value) => ({ value, label: labels[value] }));
}

export const KYB_STATUS_LABELS: Readonly<Record<KybStatus, string>> = {
	PENDING: "Pending",
	APPROVED: "Approved",
	REJECTED: "Rejected",
	ACTION_REQUIRED: "Action required",
};

export const MERCHANT_ORG_STATUS_LABELS: Readonly<Record<MerchantOrgStatus, string>> = {
	ONBOARDING: "Onboarding",
	ACTIVE: "Active",
	SUSPENDED: "Suspended",
};

export const ADMIN_USER_STATUS_LABELS: Readonly<Record<AdminUserStatus, string>> = {
	active: "Active",
	inactive: "Inactive",
	locked: "Locked",
};

export const EMAIL_LOG_STATUS_LABELS: Readonly<Record<EmailLogStatus, string>> = {
	pending: "Pending",
	sent: "Sent",
	delivered: "Delivered",
	bounced: "Bounced",
	complained: "Complained",
	failed: "Failed",
};

export const AUDIT_OUTCOME_LABELS: Readonly<Record<AuditOutcome, string>> = {
	SUCCEEDED: "Succeeded",
	FAILED: "Failed",
};

export const AUDIT_HTTP_METHOD_LABELS: Readonly<Record<AuditHttpMethod, string>> = {
	POST: "POST (create / action)",
	PUT: "PUT (replace)",
	PATCH: "PATCH (update)",
	DELETE: "DELETE (delete)",
	GET: "GET (read)",
	HEAD: "HEAD (headers only)",
	OPTIONS: "OPTIONS (preflight)",
};

export const AUDIT_AUTH_METHOD_LABELS: Readonly<Record<AuditAuthMethod, string>> = {
	SESSION_COOKIE: "Session cookie",
	BEARER_TOKEN: "Bearer token",
	REFRESH_COOKIE: "Refresh cookie",
	API_KEY: "API key",
};

export const DEVICE_TYPE_LABELS: Readonly<Record<DeviceType, string>> = {
	DESKTOP: "Desktop",
	MOBILE: "Mobile",
	TABLET: "Tablet",
	BOT: "Bot",
	UNKNOWN: "Unknown / script",
};

export const IP_ADDRESS_SCOPE_LABELS: Readonly<Record<IpAddressScope, string>> = {
	PUBLIC: "Public",
	PRIVATE: "Private network",
	LOOPBACK: "Loopback",
	LINK_LOCAL: "Link-local",
	SHARED: "Carrier NAT",
	DOCUMENTATION: "Documentation range",
	MULTICAST: "Multicast",
	RESERVED: "Reserved",
};
