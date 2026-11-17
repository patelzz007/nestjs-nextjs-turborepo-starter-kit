// The admin's tier rules form (ADR 085): what staff type, read as the shared `UpdateTierSettingsSchema` checks it.

import { UpdateTierSettingsSchema, type TierRules, type UpdateTierSettingsInput } from "@workspace/shared";
import { z } from "zod";

/** One number of the tier rules. */
export type TierRuleField = keyof TierRules;

/** Each rule as the form shows it: its label and what it means. In the order the form lists them. */
export const TIER_RULE_FIELDS: readonly { readonly field: TierRuleField; readonly label: string; readonly hint: string }[] = [
	{ field: "silverThreshold", label: "Silver at", hint: "Counted redemptions in the window that reach Silver." },
	{ field: "goldThreshold", label: "Gold at", hint: "More than Silver." },
	{ field: "diamondThreshold", label: "Diamond at", hint: "More than Gold." },
	{ field: "windowDays", label: "Window (days)", hint: "How far back redemptions count." },
	{ field: "perMerchantCap", label: "Per-merchant cap", hint: "At most this many from one merchant count in a window." },
	{ field: "holdDays", label: "Hold (days)", hint: "After a promotion, no demotion for this long." },
	{ field: "warningDays", label: "Warning (days)", hint: "How long before a demotion the customer is told." },
];

/** What staff typed: every rule as text (a cleared box reads as missing, never 0), and why. */
export type TierSettingsDraft = Readonly<Record<TierRuleField, string>> & { readonly reason: string };

/** A box of the form, by its input `name`: a rule, or the reason. */
export const TierSettingsDraftFieldSchema = z.enum([
	"silverThreshold",
	"goldThreshold",
	"diamondThreshold",
	"windowDays",
	"perMerchantCap",
	"holdDays",
	"warningDays",
	"reason",
]);
export type TierSettingsDraftField = z.output<typeof TierSettingsDraftFieldSchema>;

/** The draft with one box's new text. */
export function withDraftField(draft: TierSettingsDraft, field: TierSettingsDraftField, value: string): TierSettingsDraft {
	return { ...draft, [field]: value };
}

/** The rules in force as the form starts, with no reason yet. */
export function toTierSettingsDraft(rules: TierRules): TierSettingsDraft {
	return {
		silverThreshold: String(rules.silverThreshold),
		goldThreshold: String(rules.goldThreshold),
		diamondThreshold: String(rules.diamondThreshold),
		windowDays: String(rules.windowDays),
		perMerchantCap: String(rules.perMerchantCap),
		holdDays: String(rules.holdDays),
		warningDays: String(rules.warningDays),
		reason: "",
	};
}

/** A box's text as the schema reads it: blank is `NaN` (reported missing), never 0. */
function numberOf(text: string): number {
	const trimmed = text.trim();
	return trimmed.length === 0 ? Number.NaN : Number(trimmed);
}

/** The draft in the shape the API takes. */
function candidateOf(draft: TierSettingsDraft): Readonly<Record<TierRuleField, number>> & { readonly reason: string } {
	return {
		silverThreshold: numberOf(draft.silverThreshold),
		goldThreshold: numberOf(draft.goldThreshold),
		diamondThreshold: numberOf(draft.diamondThreshold),
		windowDays: numberOf(draft.windowDays),
		perMerchantCap: numberOf(draft.perMerchantCap),
		holdDays: numberOf(draft.holdDays),
		warningDays: numberOf(draft.warningDays),
		reason: draft.reason,
	};
}

/** The rules to save, or each field's first problem (`reason` included). */
export type TierSettingsCheck =
	| { readonly ok: true; readonly input: UpdateTierSettingsInput }
	| { readonly ok: false; readonly errors: Readonly<Partial<Record<TierSettingsDraftField, string>>> };

export function checkTierSettings(draft: TierSettingsDraft): TierSettingsCheck {
	const result = UpdateTierSettingsSchema.safeParse(candidateOf(draft));
	if (result.success) {
		return { ok: true, input: result.data };
	}
	const errors: Partial<Record<TierSettingsDraftField, string>> = {};
	for (const issue of result.error.issues) {
		const [head] = issue.path;
		const field = TierSettingsDraftFieldSchema.safeParse(head);
		if (field.success && errors[field.data] === undefined) {
			errors[field.data] = issue.message;
		}
	}
	return { ok: false, errors };
}
