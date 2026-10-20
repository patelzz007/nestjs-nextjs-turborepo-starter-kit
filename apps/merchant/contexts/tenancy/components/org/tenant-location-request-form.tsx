"use client";

import { resolveAuthErrorMessage } from "@workspace/client/lib/api/error-messages";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LocationCreateSchema, type LocationResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import * as React from "react";

export interface LocationRequestFormProps {
	readonly tenantSlug: string;
	readonly mode: "create" | "resubmit";
	readonly location?: LocationResponse;
	readonly onSuccess?: () => void;
	readonly onCancel?: () => void;
}

export function LocationRequestForm({ tenantSlug, mode, location, onSuccess, onCancel }: LocationRequestFormProps): React.JSX.Element {
	const { api } = useAuth();
	const [name, setName] = React.useState(location?.name ?? "");
	const [addressText, setAddressText] = React.useState(location?.addressText ?? "");
	const [contactPhone, setContactPhone] = React.useState(location?.contactPhone ?? "");
	const [error, setError] = React.useState<string | null>(null);

	const createMutation = api.tenants.locations.create.useMutation({
		onSuccess: (): void => {
			setError(null);
			onSuccess?.();
		},
		onError: (mutationError): void => {
			setError(resolveAuthErrorMessage(mutationError));
		},
	});

	const updateMutation = api.tenants.locations.update.useMutation({
		onSuccess: (): void => {
			setError(null);
			onSuccess?.();
		},
		onError: (mutationError): void => {
			setError(resolveAuthErrorMessage(mutationError));
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const handleNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);

	const handleAddressChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setAddressText(event.target.value);
	}, []);

	const handlePhoneChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setContactPhone(event.target.value);
	}, []);

	const handleSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setError(null);

			const payload = {
				name,
				addressText,
				contactPhone: contactPhone.trim().length > 0 ? contactPhone.trim() : undefined,
			};

			const parsed = LocationCreateSchema.safeParse(payload);
			if (!parsed.success) {
				setError(parsed.error.message || "Check the store details and try again.");
				return;
			}

			if (mode === "create") {
				createMutation.mutate({ tenantSlug, ...parsed.data });
				return;
			}

			if (location === undefined) {
				setError("Missing store to resubmit.");
				return;
			}

			updateMutation.mutate({ tenantSlug, locationId: location.id, ...parsed.data });
		},
		[addressText, contactPhone, createMutation, location, mode, name, tenantSlug, updateMutation],
	);

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-2">
				<Label htmlFor="location-name">Store name</Label>
				<Input id="location-name" value={name} onChange={handleNameChange} disabled={isPending} required />
			</div>
			<div className="space-y-2">
				<Label htmlFor="location-address">Address</Label>
				<Textarea id="location-address" value={addressText} onChange={handleAddressChange} disabled={isPending} required rows={3} />
			</div>
			<div className="space-y-2">
				<Label htmlFor="location-phone">Contact phone (optional)</Label>
				<Input id="location-phone" value={contactPhone} onChange={handlePhoneChange} disabled={isPending} />
			</div>
			{error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
			<div className="flex flex-wrap gap-2">
				<Button type="submit" disabled={isPending}>
					{mode === "create" ? "Submit for approval" : "Resubmit for approval"}
				</Button>
				{onCancel !== undefined ? (
					<Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
						Cancel
					</Button>
				) : null}
			</div>
		</form>
	);
}
