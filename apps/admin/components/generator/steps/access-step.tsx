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

interface RlsPolicyOptionProps {
	readonly option: { value: RlsPolicy; label: string; description: string };
	readonly selected: boolean;
	readonly onSelect: (value: RlsPolicy) => void;
}

function RlsPolicyOption({ option, selected, onSelect }: RlsPolicyOptionProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(option.value);
	}, [onSelect, option.value]);

	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={handleClick}
			className={cn("rounded-xl border px-4 py-3 text-left transition-colors", selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
			<p className="text-sm font-medium">{option.label}</p>
			<p className="text-xs text-muted-foreground">{option.description}</p>
		</button>
	);
}

interface DraftSwitchRowProps {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly checked: boolean;
	readonly onCheckedChange: (checked: boolean) => void;
}

function DraftSwitchRow({ id, label, description, checked, onCheckedChange }: DraftSwitchRowProps): React.JSX.Element {
	return (
		<div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
			<div>
				<Label htmlFor={id}>{label}</Label>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

export const GeneratorAccessStep = React.memo(function GeneratorAccessStep({ draft, onDraftChange }: GeneratorAccessStepProps): React.JSX.Element {
	const handleRlsSelect = React.useCallback(
		function handleRlsSelect(value: RlsPolicy): void {
			onDraftChange({ ...draft, rls: value });
		},
		[draft, onDraftChange],
	);

	const handleSoftDeleteChange = React.useCallback(
		function handleSoftDeleteChange(checked: boolean): void {
			onDraftChange({ ...draft, softDelete: checked });
		},
		[draft, onDraftChange],
	);

	const handleShowAdvancedChange = React.useCallback(
		function handleShowAdvancedChange(checked: boolean): void {
			onDraftChange({ ...draft, showAdvanced: checked });
		},
		[draft, onDraftChange],
	);

	const handleConcurrencyChange = React.useCallback(
		function handleConcurrencyChange(checked: boolean): void {
			onDraftChange({ ...draft, concurrency: checked });
		},
		[draft, onDraftChange],
	);

	const handleIdempotencyChange = React.useCallback(
		function handleIdempotencyChange(checked: boolean): void {
			onDraftChange({ ...draft, idempotency: checked });
		},
		[draft, onDraftChange],
	);

	return (
		<div className="grid gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Row-level security</CardTitle>
					<CardDescription>Choose who can access rows for this resource.</CardDescription>
				</CardHeader>
				<CardContent>
					<div role="radiogroup" aria-label="Row-level security policy" className="grid gap-3">
						{RLS_OPTIONS.map((option) => (
							<RlsPolicyOption key={option.value} option={option} selected={draft.rls === option.value} onSelect={handleRlsSelect} />
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Lifecycle</CardTitle>
					<CardDescription>Common patterns for deletes and concurrent updates.</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<DraftSwitchRow
						id="generator-soft-delete"
						label="Soft delete"
						description="Rows get deletedAt instead of being removed."
						checked={draft.softDelete}
						onCheckedChange={handleSoftDeleteChange}
					/>

					<DraftSwitchRow
						id="generator-advanced"
						label="Advanced options"
						description="Optimistic concurrency and idempotency hooks."
						checked={draft.showAdvanced}
						onCheckedChange={handleShowAdvancedChange}
					/>

					{draft.showAdvanced ? (
						<div className="grid gap-3 rounded-xl border border-dashed p-4">
							<DraftSwitchRow
								id="generator-concurrency"
								label="Optimistic concurrency"
								description="Adds a version column for safe concurrent updates."
								checked={draft.concurrency}
								onCheckedChange={handleConcurrencyChange}
							/>
							<DraftSwitchRow
								id="generator-idempotency"
								label="Idempotency hooks"
								description="Protect write endpoints from duplicate submissions."
								checked={draft.idempotency}
								onCheckedChange={handleIdempotencyChange}
							/>
						</div>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
});

GeneratorAccessStep.displayName = "GeneratorAccessStep";
