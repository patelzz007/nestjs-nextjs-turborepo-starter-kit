"use client";

import { useMerchantLocation } from "@/lib/org/location-context";
import type { MerchantRewardFormValues, OrganizationLocationScopeType } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { MapPin } from "lucide-react";
import * as React from "react";
import type { Control, FieldErrors, UseFormSetValue } from "react-hook-form";
import { useWatch } from "react-hook-form";

const LOCATION_SCOPE_OPTIONS: readonly { readonly value: OrganizationLocationScopeType; readonly label: string }[] = [
	{ value: "ALL_LOCATIONS", label: "All stores" },
	{ value: "SELECTED", label: "Selected stores only" },
];

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
		<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/60 p-3 transition-colors hover:border-primary/35">
			<Checkbox checked={checked} onCheckedChange={handleCheckedChange} disabled={disabled} />
			<span className="min-w-0 space-y-1">
				<span className="block font-medium text-foreground">{name}</span>
				{addressText !== null ? <span className="block text-xs text-muted-foreground">{addressText}</span> : null}
			</span>
		</label>
	);
}

export interface MerchantRewardLocationFieldsProps {
	readonly control: Control<MerchantRewardFormValues>;
	readonly errors: FieldErrors<MerchantRewardFormValues>;
	readonly setValue: UseFormSetValue<MerchantRewardFormValues>;
	readonly disabled?: boolean;
}

export function MerchantRewardLocationFields({ control, errors, setValue, disabled = false }: MerchantRewardLocationFieldsProps): React.JSX.Element | null {
	const { accessibleLocations } = useMerchantLocation();
	const locationScopeType = useWatch({ control, name: "locationScopeType" }) ?? "ALL_LOCATIONS";
	const watchedLocationIds = useWatch({ control, name: "locationIds" });
	const locationIds = React.useMemo((): readonly string[] => watchedLocationIds ?? [], [watchedLocationIds]);

	const handleScopeChange = React.useCallback(
		(value: string | null): void => {
			if (value === "ALL_LOCATIONS" || value === "SELECTED") {
				setValue("locationScopeType", value, { shouldValidate: true });
				if (value === "ALL_LOCATIONS") {
					setValue("locationIds", [], { shouldValidate: true });
				}
			}
		},
		[setValue],
	);

	const handleLocationToggle = React.useCallback(
		(locationId: string, checked: boolean): void => {
			const nextIds = checked ? [...locationIds, locationId] : locationIds.filter((id) => id !== locationId);
			setValue("locationIds", nextIds, { shouldValidate: true });
		},
		[locationIds, setValue],
	);

	if (accessibleLocations.length <= 1) {
		return null;
	}

	return (
		<Card className="border-border/80 bg-card shadow-xs">
			<CardHeader className="pb-4">
				<div className="flex items-center gap-2">
					<MapPin className="size-4 text-primary" aria-hidden="true" />
					<CardTitle className="text-base">Store availability</CardTitle>
				</div>
				<CardDescription>Choose which stores can run this reward. Single-store organizations skip this step automatically.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="reward-location-scope">Availability</Label>
					<Select value={locationScopeType} onValueChange={handleScopeChange} disabled={disabled}>
						<SelectTrigger id="reward-location-scope">
							<SelectValue placeholder="Select availability" />
						</SelectTrigger>
						<SelectContent>
							{LOCATION_SCOPE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{locationScopeType === "SELECTED" ? (
					<div className="space-y-3">
						<p className="text-sm font-medium text-foreground">Select stores</p>
						<div className="grid gap-3 sm:grid-cols-2">
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
						{errors.locationIds !== undefined ? <p className="text-sm text-destructive">{errors.locationIds.message}</p> : null}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
