import { JsonObjectSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { buildKybUpdate, KYB_STATUSES_REQUIRING_REASON, KybReviewFormSchema, toKybReviewFormValues } from "@/lib/merchants/kyb-review-form";

const REVIEWED_AT_MS = 1_786_300_000_000;
const STORED = JsonObjectSchema.parse({ registrationNo: "201901012345", submittedAt: 1_786_000_000_000, rejectionReason: "Old reason", reviewedAt: 1 });

describe("KybReviewFormSchema", () => {
	it("covers both statuses the merchant must act on", () => {
		expect(KYB_STATUSES_REQUIRING_REASON).toEqual(["REJECTED", "ACTION_REQUIRED"]);
	});

	it("requires the reviewer's own reason for a rejection or a request for action — none is invented", () => {
		for (const kybStatus of KYB_STATUSES_REQUIRING_REASON) {
			const result = KybReviewFormSchema.safeParse({ ...toKybReviewFormValues(kybStatus, null), rejectionReason: "  " });
			expect(result.success, kybStatus).toBe(false);
		}
	});

	it("accepts an approval without a reason", () => {
		expect(KybReviewFormSchema.safeParse(toKybReviewFormValues("APPROVED", null)).success).toBe(true);
	});
});

describe("buildKybUpdate", () => {
	it("keeps keys the form does not own, applies the form's fields and stamps the review time", () => {
		const decision = KybReviewFormSchema.parse({ ...toKybReviewFormValues("APPROVED", STORED), taxId: " C123 ", rejectionReason: "" });
		expect(buildKybUpdate(STORED, decision, REVIEWED_AT_MS)).toEqual({
			kybStatus: "APPROVED",
			kybFields: { submittedAt: 1_786_000_000_000, registrationNo: "201901012345", taxId: "C123", reviewedAt: REVIEWED_AT_MS },
		});
	});

	it("pre-fills the form from the stored payload", () => {
		expect(toKybReviewFormValues("PENDING", STORED)).toMatchObject({ registrationNo: "201901012345", rejectionReason: "Old reason", taxId: "" });
	});
});
