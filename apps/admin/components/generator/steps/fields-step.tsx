"use client";

import { fieldKindLabel, type DiscoveredModel } from "@workspace/cli/generator";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@workspace/ui/components/feedback/empty";
import { FieldError } from "@workspace/ui/components/form/field";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { GeneratorFieldEditorSheet, openNewForeignKeyFieldEditor, openNewScalarFieldEditor } from "@/components/generator/field-editor-sheet";
import { resolveModelName, type GeneratorFieldDraft, type GeneratorWizardDraft } from "@/lib/generator/wizard-draft";

export interface GeneratorFieldsStepProps {
	readonly draft: GeneratorWizardDraft;
	readonly parentModels: readonly DiscoveredModel[];
	readonly error: string | null;
	readonly onDraftChange: (draft: GeneratorWizardDraft) => void;
}

function describeField(field: GeneratorFieldDraft): string {
	if (field.entryType === "foreign-key") {
		return `link → ${field.relationModel ?? "?"}`;
	}
	return fieldKindLabel(field.kind);
}

export const GeneratorFieldsStep = React.memo(function GeneratorFieldsStep({ draft, parentModels, error, onDraftChange }: GeneratorFieldsStepProps): React.JSX.Element {
	const [editorOpen, setEditorOpen] = React.useState(false);
	const [editingField, setEditingField] = React.useState<GeneratorFieldDraft | null>(null);
	const currentResourceName = resolveModelName(draft.name);
	const existingFieldNames = React.useMemo(() => new Set(draft.fields.map((field) => field.name)), [draft.fields]);
	const linkableParents = parentModels.filter((model) => model.modelName !== currentResourceName);

	const openEditor = (field: GeneratorFieldDraft): void => {
		setEditingField(field);
		setEditorOpen(true);
	};

	const handleAddScalar = (): void => {
		openEditor(openNewScalarFieldEditor());
	};

	const handleAddForeignKey = (): void => {
		const firstParent = linkableParents[0];
		if (firstParent === undefined) {
			return;
		}
		openEditor(openNewForeignKeyFieldEditor(firstParent.modelName));
	};

	const handleSaveField = (field: GeneratorFieldDraft): void => {
		const existingIndex = draft.fields.findIndex((item) => item.id === field.id);
		const nextFields = existingIndex >= 0 ? draft.fields.map((item, index) => (index === existingIndex ? field : item)) : [...draft.fields, field];
		onDraftChange({ ...draft, fields: nextFields });
	};

	const handleDeleteField = (fieldId: string): void => {
		onDraftChange({ ...draft, fields: draft.fields.filter((field) => field.id !== fieldId) });
	};

	return (
		<div className="grid gap-6">
			<Card>
				<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle>Table columns</CardTitle>
						<CardDescription>Each resource becomes one database table. System columns are added automatically.</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="outline" size="sm" onClick={handleAddScalar}>
							<Plus className="size-4" aria-hidden="true" />
							Regular column
						</Button>
						<Button type="button" variant="outline" size="sm" onClick={handleAddForeignKey} disabled={linkableParents.length === 0}>
							<Link2 className="size-4" aria-hidden="true" />
							Link to table
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{draft.fields.length === 0 ? (
						<Empty className="border">
							<EmptyContent>
								<EmptyTitle>No columns yet</EmptyTitle>
								<EmptyDescription>Add at least one business column. Start with a name or title field.</EmptyDescription>
								<Button type="button" onClick={handleAddScalar}>
									<Plus className="size-4" aria-hidden="true" />
									Add first column
								</Button>
							</EmptyContent>
						</Empty>
					) : (
						<ul className="grid gap-3">
							{draft.fields.map((field) => (
								<li key={field.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium">{field.name.length > 0 ? field.name : "Untitled column"}</p>
											<Badge variant="secondary">{describeField(field)}</Badge>
											{field.required ? <Badge variant="outline">required</Badge> : null}
										</div>
									</div>
									<div className="flex shrink-0 gap-1">
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label={`Edit ${field.name}`}
											onClick={() => {
												openEditor(field);
											}}>
											<Pencil className="size-4" />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											aria-label={`Remove ${field.name}`}
											onClick={() => {
												handleDeleteField(field.id);
											}}>
											<Trash2 className="size-4" />
										</Button>
									</div>
								</li>
							))}
						</ul>
					)}

					{linkableParents.length === 0 ? (
						<p className="mt-4 text-xs text-muted-foreground">To link tables, create the parent resource first, then add a foreign key column here.</p>
					) : (
						<p className="mt-4 text-xs text-muted-foreground">Available parent tables: {linkableParents.map((model) => model.modelName).join(", ")}</p>
					)}

					{error !== null ? <FieldError className="mt-4" errors={[{ message: error }]} /> : null}
				</CardContent>
			</Card>

			<GeneratorFieldEditorSheet
				open={editorOpen}
				field={editingField}
				existingFieldNames={existingFieldNames}
				parentModels={parentModels}
				currentResourceName={currentResourceName}
				onOpenChange={setEditorOpen}
				onSave={handleSaveField}
			/>
		</div>
	);
});

GeneratorFieldsStep.displayName = "GeneratorFieldsStep";
