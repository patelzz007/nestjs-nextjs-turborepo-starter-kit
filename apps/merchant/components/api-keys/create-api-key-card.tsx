"use client";

import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/form/native-select";
import {
	API_KEY_SCOPE_OPTIONS,
	ORGANIZATION_WIDE_STORE_CHOICE,
	type ApiKeyStoreChoices,
	type ApiKeyStoreOption,
	type CreateApiKeyField,
} from "@/lib/api-keys/create-api-key-form";
import { fieldErrorMessage, formErrorMessage, type FormSubmissionError } from "@/lib/forms/api-field-errors";
import { MERCHANT_API_KEY_NAME_MAX_LENGTH } from "@workspace/shared";
import { EyeOff, KeyRound, MapPin, Plus, ShieldOff } from "lucide-react";
import * as React from "react";

const KEY_FACTS: readonly { readonly icon: React.ReactNode; readonly text: string }[] = [
	{ icon: <MapPin className="size-3.5" aria-hidden="true" />, text: "Limited to the store you choose" },
	{ icon: <EyeOff className="size-3.5" aria-hidden="true" />, text: "Secret shown once" },
	{ icon: <ShieldOff className="size-3.5" aria-hidden="true" />, text: "Revocable at any time" },
];

export interface CreateApiKeyCardProps {
	readonly name: string;
	readonly onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	readonly onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
	/** The select's value: a store id, {@link ORGANIZATION_WIDE_STORE_CHOICE}, or `""` until chosen. */
	readonly storeChoice: string;
	readonly onStoreChoiceChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
	/** The stores this member may create a key for (organization-wide only for an all-locations member). */
	readonly storeChoices: ApiKeyStoreChoices;
	/** The select's value: one of the shared API key scopes. */
	readonly scope: string;
	readonly onScopeChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
	/** Whether the form values pass the shared create schema and the member's store scope. */
	readonly canSubmit: boolean;
	readonly isPending: boolean;
	/** The last create attempt's failure — on the field it is about, or for the form — shown inline so the input is kept. */
	readonly submissionError: FormSubmissionError<CreateApiKeyField> | null;
}

function FieldError({ id, message }: { readonly id: string; readonly message: string | undefined }): React.JSX.Element | null {
	return message === undefined ? null : (
		<p id={id} role="alert" className="text-xs text-destructive">
			{message}
		</p>
	);
}

/** Full-width "create a terminal key" panel. Presentational — the parent owns the mutation. */
export function CreateApiKeyCard({
	name,
	onNameChange,
	onSubmit,
	storeChoice,
	onStoreChoiceChange,
	storeChoices,
	scope,
	onScopeChange,
	canSubmit,
	isPending,
	submissionError,
}: CreateApiKeyCardProps): React.JSX.Element {
	const hasNoStore = storeChoices.stores.length === 0 && !storeChoices.allowOrganizationWide;
	const storeError = fieldErrorMessage(submissionError, "store");
	const formError = formErrorMessage(submissionError);
	const scopeDescription = API_KEY_SCOPE_OPTIONS.find((option) => option.scope === scope)?.description;

	return (
		<section aria-labelledby="create-api-key-heading" className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xs">
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/12 via-primary/3 to-transparent" />
			<div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-10">
				<div className="flex items-start gap-4">
					<span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
						<KeyRound className="size-6" aria-hidden="true" />
					</span>
					<div className="min-w-0 space-y-3">
						<div className="space-y-1">
							<h2 id="create-api-key-heading" className="text-lg font-semibold tracking-tight text-foreground">
								Create a terminal key
							</h2>
							<p className="text-sm text-muted-foreground">Give each POS device its own key, so you can switch one off without touching the rest.</p>
						</div>
						<ul className="flex flex-wrap gap-2">
							{KEY_FACTS.map((fact): React.JSX.Element => (
								<li key={fact.text} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
									<span className="text-primary">{fact.icon}</span>
									{fact.text}
								</li>
							))}
						</ul>
					</div>
				</div>

				<form className="space-y-3 rounded-lg border border-border bg-background/80 p-4" onSubmit={onSubmit} noValidate>
					<div className="grid gap-2">
						<Label htmlFor="key-name">Terminal name</Label>
						<Input id="key-name" value={name} onChange={onNameChange} placeholder="Front counter POS" maxLength={MERCHANT_API_KEY_NAME_MAX_LENGTH} required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="key-store">Store</Label>
						<NativeSelect
							id="key-store"
							className="w-full"
							value={storeChoice}
							onChange={onStoreChoiceChange}
							required
							disabled={hasNoStore}
							aria-invalid={storeError !== undefined}
							aria-describedby={storeError === undefined ? "key-store-hint" : "key-store-hint key-store-error"}>
							<NativeSelectOption value="" disabled>
								Choose a store
							</NativeSelectOption>
							{storeChoices.stores.map((store: ApiKeyStoreOption): React.JSX.Element => (
								<NativeSelectOption key={store.id} value={store.id}>
									{store.name}
								</NativeSelectOption>
							))}
							{storeChoices.allowOrganizationWide ? <NativeSelectOption value={ORGANIZATION_WIDE_STORE_CHOICE}>Every store (organization-wide)</NativeSelectOption> : null}
						</NativeSelect>
						<p id="key-store-hint" className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<MapPin className="size-3.5 shrink-0" aria-hidden="true" />
							{hasNoStore ? "No active store yet — add one under Settings › Locations first." : "The key only works at the store you choose."}
						</p>
						<FieldError id="key-store-error" message={storeError} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="key-scope">Access</Label>
						<NativeSelect id="key-scope" className="w-full" value={scope} onChange={onScopeChange} aria-describedby="key-scope-hint">
							{API_KEY_SCOPE_OPTIONS.map((option): React.JSX.Element => (
								<NativeSelectOption key={option.scope} value={option.scope}>
									{option.label}
								</NativeSelectOption>
							))}
						</NativeSelect>
						<p id="key-scope-hint" className="text-xs text-muted-foreground">
							{scopeDescription}
						</p>
					</div>
					{formError === undefined ? null : (
						<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{formError}
						</p>
					)}
					<Button type="submit" loading={isPending} disabled={isPending || !canSubmit}>
						<Plus className="size-4" aria-hidden="true" />
						Create API key
					</Button>
				</form>
			</div>
		</section>
	);
}
