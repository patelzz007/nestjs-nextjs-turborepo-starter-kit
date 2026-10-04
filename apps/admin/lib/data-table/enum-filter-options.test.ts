import { AdminUserStatusSchema, EmailLogStatusSchema, KybStatusSchema, MerchantOrgStatusSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ADMIN_USER_STATUS_LABELS, EMAIL_LOG_STATUS_LABELS, enumFilterOptions, KYB_STATUS_LABELS, MERCHANT_ORG_STATUS_LABELS } from "@/lib/data-table/enum-filter-options";

describe("enumFilterOptions", () => {
	it("offers every value of the shared enum, in order, with its label", () => {
		expect(enumFilterOptions(KybStatusSchema.options, KYB_STATUS_LABELS)).toEqual([
			{ value: "PENDING", label: "Pending" },
			{ value: "APPROVED", label: "Approved" },
			{ value: "REJECTED", label: "Rejected" },
			{ value: "ACTION_REQUIRED", label: "Action required" },
		]);
	});

	it("labels every value of each filtered enum", () => {
		expect(enumFilterOptions(MerchantOrgStatusSchema.options, MERCHANT_ORG_STATUS_LABELS)).toHaveLength(MerchantOrgStatusSchema.options.length);
		expect(enumFilterOptions(AdminUserStatusSchema.options, ADMIN_USER_STATUS_LABELS)).toHaveLength(AdminUserStatusSchema.options.length);
		expect(enumFilterOptions(EmailLogStatusSchema.options, EMAIL_LOG_STATUS_LABELS).every((option) => option.label.length > 0)).toBe(true);
	});
});
