"use client";

import { useMerchantLocation } from "@/features/tenant-context/facade";
import { LocationScopeTypeSchema, type MerchantRewardFormValues, type LocationScopeType } from "@workspace/shared";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import * as React from "react";
import type { Control, FieldErrors, UseFormSetValue } from "react-hook-form";
import { useWatch } from "react-hook-form";

interface LocationScopeOption {
	readonly value: LocationScopeType;
	readonly label: string;
	readonly hint: string;
}

/** Where a reward can run — every store, or the ones the merchant ticks. */
const LOCATION_SCOPE_OPTIONS: readonly LocationScopeOption[] = [
	{ value: "ALL_LOCATIONS", label: "All stores", hint: "Including stores you open later." },
	{ value: "SELECTED", label: "Only some stores", hint: "Pick the stores below." },
];

/** One selectable surface for a choice: the control, then its label and hint; the whole surface is clickable. */
const CHOICE_SURFACE_CLASS =
	"flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 font-normal transition-colors duration-150 hover:border-foreground/20 has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60 motion-reduce:transition-none dark:has-data-checked:bg-primary/10";

interface MerchantRewardLocationCheckboxProps {
	readonly locationId: string;
	readonly name: string;
	readonly addressText: string | null;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly onToggle: (locationId: string, checked: boolean) => void;
}

function MerchantRewardLocationCheckbox({ locationId, name, addressText, checked, disabled, onToggle }: MerchantRewardLocationCheckboxProps): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(nextChecked: boolean): void => {
			onToggle(locationId, nextChecked);
		},
		[locationId, onToggle],
	);

	return (
		<Label className={CHOICE_SURFACE_CLASS}>
			<Checkbox checked={checked} onCheckedChange={handleCheckedChange} disabled={disabled} className="mt-0.5" />
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="text-sm font-medium text-foreground">{name}</span>
				{addressText !== null ? <span className="text-xs text-muted-foreground">{addressText}</span> : null}
			</span>
		</Label>
	);
}

export interface MerchantRewardLocationFieldsProps {
	readonly control: Control<MerchantRewardFormValues>;
	readonly errors: FieldErrors<MerchantRewardFormValues>;
	readonly setValue: UseFormSetValue<MerchantRewardFormValues>;
	readonly disabled?: boolean;
}

/**
 * Which stores accept the reward: all of them, or the ones ticked. Renders
 * only the field's body (the editor's "Where" section carries the heading) and
 * nothing at all for a single-store tenant — there is nothing to choose.
 */
export function MerchantRewardLocationFields({ control, errors, setValue, disabled = false }: MerchantRewardLocationFieldsProps): React.JSX.Element | null {
	const { accessibleLocations } = useMerchantLocation();
	const locationScopeType = useWatch({ control, name: "locationScopeType" }) ?? "ALL_LOCATIONS";
	const watchedLocationIds = useWatch({ control, name: "locationIds" });
	const locationIds = React.useMemo((): readonly string[] => watchedLocationIds ?? [], [watchedLocationIds]);

	const handleScopeChange = React.useCallback(
		(value: string): void => {
			const parsed = LocationScopeTypeSchema.safeParse(value);
			if (!parsed.success) {
				return;
			}
			setValue("locationScopeType", parsed.data, { shouldValidate: true, shouldDirty: true });
			if (parsed.data === "ALL_LOCATIONS") {
				setValue("locationIds", [], { shouldValidate: true, shouldDirty: true });
			}
		},
		[setValue],
	);

	const handleLocationToggle = React.useCallback(
		(locationId: string, checked: boolean): void => {
			const nextIds = checked ? [...locationIds, locationId] : locationIds.filter((id) => id !== locationId);
			setValue("locationIds", nextIds, { shouldValidate: true, shouldDirty: true });
		},
		[locationIds, setValue],
	);

	if (accessibleLocations.length <= 1) {
		return null;
	}

	return (
		<div className="flex flex-col gap-4">
			<RadioGroup aria-label="Where it can be redeemed" value={locationScopeType} onValueChange={handleScopeChange} disabled={disabled} className="grid gap-2 sm:grid-cols-2">
				{LOCATION_SCOPE_OPTIONS.map((option): React.JSX.Element => (
					<Label key={option.value} className={CHOICE_SURFACE_CLASS}>
						<RadioGroupItem value={option.value} className="mt-0.5" />
						<span className="flex flex-col gap-0.5">
							<span className="text-sm font-medium text-foreground">{option.label}</span>
							<span className="text-xs text-muted-foreground">{option.hint}</span>
						</span>
					</Label>
				))}
			</RadioGroup>

			{locationScopeType === "SELECTED" ? (
				<fieldset className="flex flex-col gap-2.5">
					<legend className="mb-2.5 text-sm font-medium text-foreground">Stores</legend>
					<div className="grid gap-2 sm:grid-cols-2">
						{accessibleLocations.map((location) => (
							<MerchantRewardLocationCheckbox
								key={location.id}
								locationId={location.id}
								name={location.name}
								addressText={location.addressText}
								checked={locationIds.includes(location.id)}
								disabled={disabled}
								onToggle={handleLocationToggle}
							/>
						))}
					</div>
					{errors.locationIds !== undefined ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.locationIds.message}
						</p>
					) : null}
				</fieldset>
			) : null}
		</div>
	);
}
