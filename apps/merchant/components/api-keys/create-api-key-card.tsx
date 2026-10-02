"use client";

import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { MERCHANT_API_KEY_NAME_MAX_LENGTH } from "@workspace/shared";
import { EyeOff, KeyRound, MapPin, Plus, ShieldOff } from "lucide-react";
import * as React from "react";

const KEY_FACTS: readonly { readonly icon: React.ReactNode; readonly text: string }[] = [
	{ icon: <MapPin className="size-3.5" aria-hidden="true" />, text: "Scoped to a store or the whole organization" },
	{ icon: <EyeOff className="size-3.5" aria-hidden="true" />, text: "Secret shown once" },
	{ icon: <ShieldOff className="size-3.5" aria-hidden="true" />, text: "Revocable at any time" },
];

export interface CreateApiKeyCardProps {
	readonly name: string;
	readonly onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	readonly onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
	readonly isPending: boolean;
	/** The store the new key will be assigned to; `undefined` = organization-wide. */
	readonly locationName: string | undefined;
}

/** Full-width "create a terminal key" panel. Presentational — the parent owns the mutation. */
export function CreateApiKeyCard({ name, onNameChange, onSubmit, isPending, locationName }: CreateApiKeyCardProps): React.JSX.Element {
	const isBlank = name.trim().length === 0;

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

				<form className="space-y-3 rounded-lg border border-border bg-background/80 p-4" onSubmit={onSubmit}>
					<Label htmlFor="key-name">Terminal name</Label>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Input
							id="key-name"
							className="sm:flex-1"
							value={name}
							onChange={onNameChange}
							placeholder="Front counter POS"
							maxLength={MERCHANT_API_KEY_NAME_MAX_LENGTH}
							aria-describedby="key-name-hint"
							required
						/>
						<Button type="submit" loading={isPending} disabled={isPending || isBlank}>
							<Plus className="size-4" aria-hidden="true" />
							Create API key
						</Button>
					</div>
					<p id="key-name-hint" className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<MapPin className="size-3.5 shrink-0" aria-hidden="true" />
						{locationName === undefined ? (
							"Works at every store in this organization."
						) : (
							<span>
								Assigned to <strong className="font-medium text-foreground">{locationName}</strong>.
							</span>
						)}
					</p>
				</form>
			</div>
		</section>
	);
}
