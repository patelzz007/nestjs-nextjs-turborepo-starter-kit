"use client";

import { CUSTOMER_TIER_LABELS, CustomerTierSchema, ENTRY_CUSTOMER_TIER, type CustomerTier } from "@workspace/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import * as React from "react";

/** "Every customer" for Bronze, "Gold and above" otherwise: who a reward's minimum tier lets claim it. */
export function minimumTierOptionLabel(tier: CustomerTier): string {
	return tier === ENTRY_CUSTOMER_TIER ? "Every customer" : `${CUSTOMER_TIER_LABELS[tier]} and above`;
}

const MINIMUM_TIER_OPTIONS: readonly SelectOption<CustomerTier>[] = CustomerTierSchema.options.map((tier: CustomerTier): SelectOption<CustomerTier> => ({
	value: tier,
	label: minimumTierOptionLabel(tier),
}));

export interface MinimumTierSelectProps {
	readonly id: string;
	readonly value: CustomerTier;
	readonly onValueChange: (tier: CustomerTier) => void;
	readonly disabled?: boolean;
	/** The id of the text that explains the choice (`aria-describedby`). */
	readonly describedById?: string;
	/** The select's name where no `<label>` points at `id` (`aria-label`). */
	readonly accessibleName?: string;
}

/** A reward's minimum tier (ADR 085): a controlled select over the four tiers. Holds no data of its own. */
export function MinimumTierSelect({ id, value, onValueChange, disabled = false, describedById, accessibleName }: MinimumTierSelectProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(next: string | null): void => {
			const parsed = CustomerTierSchema.safeParse(next);
			if (parsed.success) {
				onValueChange(parsed.data);
			}
		},
		[onValueChange],
	);
	return (
		<Select items={MINIMUM_TIER_OPTIONS} value={value} onValueChange={handleChange} disabled={disabled}>
			<SelectTrigger id={id} aria-describedby={describedById} aria-label={accessibleName}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{MINIMUM_TIER_OPTIONS.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
