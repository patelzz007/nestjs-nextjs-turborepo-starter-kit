"use client";

import type { OrganizationLocationDraft, OrganizationPrimaryLocationDraft } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Textarea } from "@workspace/ui/components/form/textarea";
import type { ChangeEvent, JSX, SyntheticEvent } from "react";
import { useCallback } from "react";

export interface OnboardingLocationDraftRow {
	readonly id: string;
	readonly draft: OrganizationLocationDraft;
}

export function createOnboardingLocationDraftRow(): OnboardingLocationDraftRow {
	return {
		id: crypto.randomUUID(),
		draft: {
			name: "",
			addressText: "",
		},
	};
}

export interface MerchantOnboardingStoresStepProps {
	readonly primaryLocation: OrganizationPrimaryLocationDraft;
	readonly onPrimaryLocationChange: (location: OrganizationPrimaryLocationDraft) => void;
	readonly additionalLocations: readonly OnboardingLocationDraftRow[];
	readonly onAdditionalLocationsChange: (locations: readonly OnboardingLocationDraftRow[]) => void;
	readonly onBack: () => void;
	readonly onContinue: () => void;
	readonly error: string | null;
}

interface AdditionalStoreFieldsProps {
	readonly row: OnboardingLocationDraftRow;
	readonly index: number;
	readonly onFieldChange: (rowId: string, field: keyof OrganizationLocationDraft, value: string) => void;
	readonly onRemove: (rowId: string) => void;
}

function AdditionalStoreFields({ row, index, onFieldChange, onRemove }: AdditionalStoreFieldsProps): JSX.Element {
	const handleRemove = useCallback((): void => {
		onRemove(row.id);
	}, [onRemove, row.id]);

	const handleNameChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>): void => {
			onFieldChange(row.id, "name", event.target.value);
		},
		[onFieldChange, row.id],
	);

	const handleAddressChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>): void => {
			onFieldChange(row.id, "addressText", event.target.value);
		},
		[onFieldChange, row.id],
	);

	const handlePhoneChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>): void => {
			onFieldChange(row.id, "contactPhone", event.target.value);
		},
		[onFieldChange, row.id],
	);

	const nameFieldId = `additional-location-name-${row.id}`;
	const addressFieldId = `additional-location-address-${row.id}`;
	const phoneFieldId = `additional-location-phone-${row.id}`;

	return (
		<div className="space-y-3 rounded-lg border border-border p-4">
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm font-medium text-foreground">Store {String(index + 1)}</p>
				<Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
					Remove
				</Button>
			</div>
			<div className="space-y-2">
				<Label htmlFor={nameFieldId}>Store name</Label>
				<Input id={nameFieldId} value={row.draft.name} onChange={handleNameChange} required />
			</div>
			<div className="space-y-2">
				<Label htmlFor={addressFieldId}>Address</Label>
				<Textarea id={addressFieldId} value={row.draft.addressText} onChange={handleAddressChange} required rows={2} />
			</div>
			<div className="space-y-2">
				<Label htmlFor={phoneFieldId}>Contact phone (optional)</Label>
				<Input id={phoneFieldId} value={row.draft.contactPhone ?? ""} onChange={handlePhoneChange} />
			</div>
		</div>
	);
}

export function MerchantOnboardingStoresStep({
	primaryLocation,
	onPrimaryLocationChange,
	additionalLocations,
	onAdditionalLocationsChange,
	onBack,
	onContinue,
	error,
}: MerchantOnboardingStoresStepProps): JSX.Element {
	const handlePrimaryNameChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>): void => {
			onPrimaryLocationChange({ ...primaryLocation, name: event.target.value });
		},
		[onPrimaryLocationChange, primaryLocation],
	);

	const handlePrimaryAddressChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>): void => {
			onPrimaryLocationChange({ ...primaryLocation, addressText: event.target.value });
		},
		[onPrimaryLocationChange, primaryLocation],
	);

	const handlePrimaryPhoneChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>): void => {
			onPrimaryLocationChange({ ...primaryLocation, contactPhone: event.target.value });
		},
		[onPrimaryLocationChange, primaryLocation],
	);

	const handleAddLocation = useCallback((): void => {
		onAdditionalLocationsChange([...additionalLocations, createOnboardingLocationDraftRow()]);
	}, [additionalLocations, onAdditionalLocationsChange]);

	const handleRemoveLocation = useCallback(
		(rowId: string): void => {
			onAdditionalLocationsChange(additionalLocations.filter((row) => row.id !== rowId));
		},
		[additionalLocations, onAdditionalLocationsChange],
	);

	const handleLocationFieldChange = useCallback(
		(rowId: string, field: keyof OrganizationLocationDraft, value: string): void => {
			onAdditionalLocationsChange(
				additionalLocations.map((row) => {
					if (row.id !== rowId) {
						return row;
					}
					return { ...row, draft: { ...row.draft, [field]: value } };
				}),
			);
		},
		[additionalLocations, onAdditionalLocationsChange],
	);

	const handleSubmit = useCallback(
		(event: SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			onContinue();
		},
		[onContinue],
	);

	return (
		<form className="space-y-6" onSubmit={handleSubmit}>
			<div className="space-y-4 rounded-lg border border-border p-4">
				<div>
					<p className="font-medium text-foreground">Primary store</p>
					<p className="mt-1 text-sm text-muted-foreground">Every merchant needs at least one store. This location is activated immediately after onboarding.</p>
				</div>
				<div className="space-y-2">
					<Label htmlFor="primary-location-name">Store name</Label>
					<Input id="primary-location-name" value={primaryLocation.name} onChange={handlePrimaryNameChange} required placeholder="Jonker Street Kitchen — Main" />
				</div>
				<div className="space-y-2">
					<Label htmlFor="primary-location-address">Store address</Label>
					<Textarea
						id="primary-location-address"
						value={primaryLocation.addressText}
						onChange={handlePrimaryAddressChange}
						required
						rows={3}
						placeholder="Street, city, postcode"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="primary-location-phone">Contact phone</Label>
					<Input id="primary-location-phone" value={primaryLocation.contactPhone} onChange={handlePrimaryPhoneChange} required autoComplete="tel" placeholder="+60321456789" />
				</div>
			</div>

			<div className="space-y-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="font-medium text-foreground">Additional stores (optional)</p>
						<p className="text-sm text-muted-foreground">Add more locations now or later from Settings → Locations.</p>
					</div>
					<Button type="button" variant="outline" size="sm" onClick={handleAddLocation}>
						Add store
					</Button>
				</div>

				{additionalLocations.map((row, index) => (
					<AdditionalStoreFields key={row.id} row={row} index={index} onFieldChange={handleLocationFieldChange} onRemove={handleRemoveLocation} />
				))}
			</div>

			{error !== null ? <p className="text-sm text-destructive">{error}</p> : null}

			<div className="flex flex-wrap gap-2">
				<Button type="button" variant="outline" onClick={onBack}>
					Back
				</Button>
				<Button type="submit">Continue</Button>
			</div>
		</form>
	);
}
