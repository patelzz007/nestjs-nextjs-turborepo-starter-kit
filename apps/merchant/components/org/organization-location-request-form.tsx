"use client";

import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/errors";
import { useAuth } from "@workspace/client/lib/auth";
import { OrganizationLocationCreateSchema, type OrganizationLocationResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Textarea } from "@workspace/ui/components/form/textarea";
import * as React from "react";

export interface OrganizationLocationRequestFormProps {
	readonly orgSlug: string;
	readonly mode: "create" | "resubmit";
	readonly location?: OrganizationLocationResponse;
	readonly onSuccess?: () => void;
	readonly onCancel?: () => void;
}

export function OrganizationLocationRequestForm({ orgSlug, mode, location, onSuccess, onCancel }: OrganizationLocationRequestFormProps): React.JSX.Element {
	const { api } = useAuth();
	const [name, setName] = React.useState(location?.name ?? "");
	const [addressText, setAddressText] = React.useState(location?.addressText ?? "");
	const [contactPhone, setContactPhone] = React.useState(location?.contactPhone ?? "");
	const [error, setError] = React.useState<string | null>(null);

	const createMutation = api.organizations.locations.create.useMutation({
		onSuccess: (): void => {
			setError(null);
			onSuccess?.();
		},
		onError: (mutationError): void => {
			setError(resolveAuthErrorMessage(mutationError));
		},
	});

	const updateMutation = api.organizations.locations.update.useMutation({
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

			const parsed = OrganizationLocationCreateSchema.safeParse(payload);
			if (!parsed.success) {
				setError(parsed.error.message || "Check the store details and try again.");
				return;
			}

			if (mode === "create") {
				createMutation.mutate({ orgSlug, ...parsed.data });
				return;
			}

			if (location === undefined) {
				setError("Missing store to resubmit.");
				return;
			}

			updateMutation.mutate({ orgSlug, locationId: location.id, ...parsed.data });
		},
		[addressText, contactPhone, createMutation, location, mode, name, orgSlug, updateMutation],
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
