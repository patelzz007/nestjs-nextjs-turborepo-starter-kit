"use client";

import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { FieldError } from "@workspace/ui/components/form/field";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Badge } from "@workspace/ui/components/feedback/badge";

import { resolveModelName, suggestNavigationLabel, type GeneratorWizardDraft } from "@/lib/generator/wizard-draft";

export interface GeneratorBasicsStepProps {
	readonly draft: GeneratorWizardDraft;
	readonly error: string | null;
	readonly onDraftChange: (draft: GeneratorWizardDraft) => void;
}

export const GeneratorBasicsStep = React.memo(function GeneratorBasicsStep({ draft, error, onDraftChange }: GeneratorBasicsStepProps): React.JSX.Element {
	const modelName = resolveModelName(draft.name);
	const nameInvalid = error !== null && modelName.length === 0;
	const labelInvalid = error !== null && draft.navigationLabel.trim().length === 0;

	const handleNameChange = React.useCallback(
		function handleNameChange(event: React.ChangeEvent<HTMLInputElement>): void {
			const nextName = event.target.value;
			onDraftChange({
				...draft,
				name: nextName,
				navigationLabel: draft.navigationLabelTouched ? draft.navigationLabel : suggestNavigationLabel(nextName),
			});
		},
		[draft, onDraftChange],
	);

	const handleNavigationLabelChange = React.useCallback(
		function handleNavigationLabelChange(event: React.ChangeEvent<HTMLInputElement>): void {
			onDraftChange({
				...draft,
				navigationLabel: event.target.value,
				navigationLabelTouched: true,
			});
		},
		[draft, onDraftChange],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Resource basics</CardTitle>
				<CardDescription>Name the resource and choose the sidebar label used by generated panels.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="grid gap-2">
					<Label htmlFor="generator-resource-name">Resource name</Label>
					<Input
						id="generator-resource-name"
						value={draft.name}
						onChange={handleNameChange}
						placeholder="Product or product-category"
						autoComplete="off"
						aria-invalid={nameInvalid ? true : undefined}
					/>
					{nameInvalid ? <FieldError errors={[{ message: "Enter a resource name." }]} /> : null}
					<p className="text-xs text-muted-foreground">PascalCase or kebab-case. The model becomes {modelName.length > 0 ? modelName : "Product"}.</p>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="generator-navigation-label">Sidebar menu label</Label>
					<Input
						id="generator-navigation-label"
						value={draft.navigationLabel}
						onChange={handleNavigationLabelChange}
						placeholder="Products"
						autoComplete="off"
						aria-invalid={labelInvalid ? true : undefined}
					/>
					{labelInvalid ? <FieldError errors={[{ message: "Enter a sidebar menu label." }]} /> : null}
				</div>

				{error !== null && !nameInvalid && !labelInvalid ? <FieldError errors={[{ message: error }]} /> : null}

				{modelName.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary">Model: {modelName}</Badge>
						<Badge variant="outline">Slug: {modelName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}</Badge>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
});

GeneratorBasicsStep.displayName = "GeneratorBasicsStep";
