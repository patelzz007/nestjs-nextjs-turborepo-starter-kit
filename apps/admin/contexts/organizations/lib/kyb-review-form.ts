// ============================================
// lib/merchants/kyb-review-form.ts - the KYB decision form ⇄ `PATCH /admin/merchants/:id/kyb`
// ============================================
// The form edits the reviewer-owned keys of the merchant's KYB payload plus
// the status. Every key the form does not own is carried over unchanged, a
// key the reviewer clears is removed, and a rejection always carries the
// reviewer's own reason — nothing is invented on their behalf.

import { AdminKybUpdateSchema, JsonObjectSchema, KybStatusSchema, type AdminKybUpdateInput, type JsonObject, type JsonValue, type KybStatus } from "@workspace/shared";
import { z } from "zod";

import { OptionalTextInputSchema } from "@/lib/forms/contract-form-schema";

/** The KYB payload keys the decision form edits. */
export const KybReviewFieldKeySchema = z.enum(["registrationNo", "taxId", "documentType", "reviewNotes", "rejectionReason"]);
export type KybReviewFieldKey = z.output<typeof KybReviewFieldKeySchema>;

/** Stamped on every saved review. */
export const KYB_REVIEWED_AT_KEY = "reviewedAt";

/** Decisions the merchant has to act on — the reviewer must say why. */
export const KYB_STATUSES_REQUIRING_REASON: readonly KybStatus[] = [KybStatusSchema.enum.REJECTED, KybStatusSchema.enum.ACTION_REQUIRED];

/** The form's raw values → its validated decision (trimmed; blank fields absent; a reason when the status needs one). */
export const KybReviewFormSchema = z
	.object({
		kybStatus: KybStatusSchema,
		registrationNo: OptionalTextInputSchema,
		taxId: OptionalTextInputSchema,
		documentType: OptionalTextInputSchema,
		reviewNotes: OptionalTextInputSchema,
		rejectionReason: OptionalTextInputSchema,
	})
	.superRefine((decision, context): void => {
		if (KYB_STATUSES_REQUIRING_REASON.includes(decision.kybStatus) && decision.rejectionReason === undefined) {
			context.addIssue({ code: "custom", message: "Tell the merchant why — a reason is required for this decision.", path: ["rejectionReason"] });
		}
	});

export type KybReviewFormValues = z.input<typeof KybReviewFormSchema>;
export type KybReviewDecision = z.output<typeof KybReviewFormSchema>;

/** A string field of the stored payload as form text (`""` when absent or not a string). */
function readTextField(kybFields: JsonObject | null, key: KybReviewFieldKey): string {
	const parsed = z.string().safeParse(kybFields?.[key]);
	return parsed.success ? parsed.data : "";
}

/** The form's starting values: the merchant's status and stored review fields. */
export function toKybReviewFormValues(kybStatus: KybStatus, kybFields: JsonObject | null): KybReviewFormValues {
	return {
		kybStatus,
		registrationNo: readTextField(kybFields, "registrationNo"),
		taxId: readTextField(kybFields, "taxId"),
		documentType: readTextField(kybFields, "documentType"),
		reviewNotes: readTextField(kybFields, "reviewNotes"),
		rejectionReason: readTextField(kybFields, "rejectionReason"),
	};
}

/**
 * The `PATCH` body for `decision`: every stored key the form does not own,
 * then the form's non-blank fields, stamped with `reviewedAtMs`. Validated
 * with the shared contract (throws on a programming error — never drops data).
 */
export function buildKybUpdate(storedFields: JsonObject | null, decision: KybReviewDecision, reviewedAtMs: number): AdminKybUpdateInput {
	const kybFields: Record<string, JsonValue> = {};
	for (const [key, value] of Object.entries(storedFields ?? {})) {
		if (!KybReviewFieldKeySchema.safeParse(key).success && key !== KYB_REVIEWED_AT_KEY) {
			kybFields[key] = value;
		}
	}
	for (const key of KybReviewFieldKeySchema.options) {
		const value = decision[key];
		if (value !== undefined) {
			kybFields[key] = value;
		}
	}
	kybFields[KYB_REVIEWED_AT_KEY] = reviewedAtMs;
	return AdminKybUpdateSchema.parse({ kybStatus: decision.kybStatus, kybFields: JsonObjectSchema.parse(kybFields) });
}
