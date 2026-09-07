"use client";

import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Label } from "@workspace/ui/components/form/label";
import { Switch } from "@workspace/ui/components/form/switch";
import type { RlsPolicy } from "@workspace/cli/generator";
import { cn } from "@/lib/utils";

import type { GeneratorWizardDraft } from "@/lib/generator/wizard-draft";

const RLS_OPTIONS: readonly { value: RlsPolicy; label: string; description: string }[] = [
	{ value: "admin-only", label: "Admin only", description: "SuperAdmin and staff panels" },
	{ value: "organization-scoped", label: "Organization scoped", description: "Tenant or merchant isolation" },
	{ value: "user-owned", label: "User owned", description: "Each user sees their own rows" },
	{ value: "public-read", label: "Public read", description: "Open reads, restricted writes" },
];

export interface GeneratorAccessStepProps {
	readonly draft: GeneratorWizardDraft;
	readonly onDraftChange: (draft: GeneratorWizardDraft) => void;
}

export const GeneratorAccessStep = React.memo(function GeneratorAccessStep({ draft, onDraftChange }: GeneratorAccessStepProps): React.JSX.Element {
	return (
		<div className="grid gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Row-level security</CardTitle>
					<CardDescription>Choose who can access rows for this resource.</CardDescription>
				</CardHeader>
				<CardContent>
					<div role="radiogroup" aria-label="Row-level security policy" className="grid gap-3">
						{RLS_OPTIONS.map((option) => {
							const selected = draft.rls === option.value;
							return (
								<button
									key={option.value}
									type="button"
									role="radio"
									aria-checked={selected}
									onClick={() => {
										onDraftChange({ ...draft, rls: option.value });
									}}
									className={cn(
										"rounded-xl border px-4 py-3 text-left transition-colors",
										selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
									)}>
									<p className="text-sm font-medium">{option.label}</p>
									<p className="text-xs text-muted-foreground">{option.description}</p>
								</button>
							);
						})}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Lifecycle</CardTitle>
					<CardDescription>Common patterns for deletes and concurrent updates.</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
						<div>
							<Label htmlFor="generator-soft-delete">Soft delete</Label>
							<p className="text-xs text-muted-foreground">Rows get deletedAt instead of being removed.</p>
						</div>
						<Switch
							id="generator-soft-delete"
							checked={draft.softDelete}
							onCheckedChange={(checked) => {
								onDraftChange({ ...draft, softDelete: checked });
							}}
						/>
					</div>

					<div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
						<div>
							<Label htmlFor="generator-advanced">Advanced options</Label>
							<p className="text-xs text-muted-foreground">Optimistic concurrency and idempotency hooks.</p>
						</div>
						<Switch
							id="generator-advanced"
							checked={draft.showAdvanced}
							onCheckedChange={(checked) => {
								onDraftChange({ ...draft, showAdvanced: checked });
							}}
						/>
					</div>

					{draft.showAdvanced ? (
						<div className="grid gap-3 rounded-xl border border-dashed p-4">
							<div className="flex items-center justify-between gap-4">
								<div>
									<Label htmlFor="generator-concurrency">Optimistic concurrency</Label>
									<p className="text-xs text-muted-foreground">Adds a version column for safe concurrent updates.</p>
								</div>
								<Switch
									id="generator-concurrency"
									checked={draft.concurrency}
									onCheckedChange={(checked) => {
										onDraftChange({ ...draft, concurrency: checked });
									}}
								/>
							</div>
							<div className="flex items-center justify-between gap-4">
								<div>
									<Label htmlFor="generator-idempotency">Idempotency hooks</Label>
									<p className="text-xs text-muted-foreground">Protect write endpoints from duplicate submissions.</p>
								</div>
								<Switch
									id="generator-idempotency"
									checked={draft.idempotency}
									onCheckedChange={(checked) => {
										onDraftChange({ ...draft, idempotency: checked });
									}}
								/>
							</div>
						</div>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
});

GeneratorAccessStep.displayName = "GeneratorAccessStep";
