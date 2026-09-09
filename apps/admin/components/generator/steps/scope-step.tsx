"use client";

import type { GeneratorUiModuleListItem } from "@workspace/cli/generator";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { FieldError } from "@workspace/ui/components/form/field";
import { Label } from "@workspace/ui/components/form/label";
import { Switch } from "@workspace/ui/components/form/switch";
import * as React from "react";

import type { GeneratorWizardDraft } from "@/lib/generator/wizard-draft";

export interface GeneratorScopeStepProps {
	readonly draft: GeneratorWizardDraft;
	readonly uiModules: readonly GeneratorUiModuleListItem[];
	readonly error: string | null;
	readonly onDraftChange: (draft: GeneratorWizardDraft) => void;
}

interface UiModuleOptionProps {
	readonly module: GeneratorUiModuleListItem;
	readonly checked: boolean;
	readonly onToggle: (moduleId: string, checked: boolean) => void;
}

function UiModuleOption({ module, checked, onToggle }: UiModuleOptionProps): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		function handleCheckedChange(value: boolean): void {
			onToggle(module.id, value);
		},
		[module.id, onToggle],
	);

	return (
		<div className="flex items-start gap-3 rounded-xl border p-4">
			<Checkbox id={`generator-ui-module-${module.id}`} checked={checked} onCheckedChange={handleCheckedChange} />
			<div className="grid gap-1">
				<Label htmlFor={`generator-ui-module-${module.id}`}>{module.id}</Label>
				<p className="font-mono text-xs text-muted-foreground">{module.resourceRouteTemplate}</p>
			</div>
			{module.id === "admin" ? <Badge variant="secondary">default</Badge> : null}
		</div>
	);
}

export const GeneratorScopeStep = React.memo(function GeneratorScopeStep({ draft, uiModules, error, onDraftChange }: GeneratorScopeStepProps): React.JSX.Element {
	const handleGenerateUiChange = React.useCallback(
		function handleGenerateUiChange(checked: boolean): void {
			onDraftChange({
				...draft,
				generateUi: checked,
				uiModules: checked && draft.uiModules.length === 0 ? ["admin"] : draft.uiModules,
			});
		},
		[draft, onDraftChange],
	);

	const toggleModule = React.useCallback(
		function toggleModule(moduleId: string, checked: boolean): void {
			const next = new Set(draft.uiModules);
			if (checked) {
				next.add(moduleId);
			} else {
				next.delete(moduleId);
			}
			onDraftChange({
				...draft,
				uiModules: [...next],
			});
		},
		[draft, onDraftChange],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Generation scope</CardTitle>
				<CardDescription>API, shared contracts, and client endpoints are always included. Choose whether to generate UI panels.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="flex items-center justify-between gap-4 rounded-xl border p-4">
					<div className="grid gap-1">
						<Label htmlFor="generator-generate-ui">Generate UI panels</Label>
						<p className="text-xs text-muted-foreground">Disable for API-only resources.</p>
					</div>
					<Switch id="generator-generate-ui" checked={draft.generateUi} onCheckedChange={handleGenerateUiChange} />
				</div>

				{draft.generateUi ? (
					<div className="grid gap-3">
						<p className="text-sm font-medium">Target panels</p>
						{uiModules.map((module) => (
							<UiModuleOption key={module.id} module={module} checked={draft.uiModules.includes(module.id)} onToggle={toggleModule} />
						))}
						{error !== null ? <FieldError errors={[{ message: error }]} /> : null}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">Only backend artifacts will be generated.</p>
				)}
			</CardContent>
		</Card>
	);
});

GeneratorScopeStep.displayName = "GeneratorScopeStep";
