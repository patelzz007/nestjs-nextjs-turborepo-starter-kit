"use client";

import {
	fieldKindLabel,
	fieldKindToScalarType,
	fieldSupportsFilterable,
	fieldSupportsSearchable,
	fieldSupportsSortable,
	isValidFieldName,
	type DiscoveredModel,
	type FieldKind,
} from "@workspace/cli/generator";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@workspace/ui/components/overlay/sheet";
import { Switch } from "@workspace/ui/components/form/switch";
import * as React from "react";

import { createDefaultForeignKeyDraft, createDefaultScalarFieldDraft, type GeneratorFieldDraft, type ListBehavior } from "@/lib/generator/wizard-draft";

const SCALAR_KINDS: readonly FieldKind[] = ["short-text", "long-text", "number", "decimal", "boolean", "enum", "datetime"];

const LIST_BEHAVIOR_OPTIONS: readonly { value: ListBehavior; label: string }[] = [
	{ value: "search-sort", label: "Searchable and sortable" },
	{ value: "sort-only", label: "Sortable only" },
	{ value: "none", label: "Neither" },
];

export interface GeneratorFieldEditorSheetProps {
	readonly open: boolean;
	readonly field: GeneratorFieldDraft | null;
	readonly existingFieldNames: ReadonlySet<string>;
	readonly parentModels: readonly DiscoveredModel[];
	readonly currentResourceName: string;
	readonly onOpenChange: (open: boolean) => void;
	readonly onSave: (field: GeneratorFieldDraft) => void;
}

export const GeneratorFieldEditorSheet = React.memo(function GeneratorFieldEditorSheet({
	open,
	field,
	existingFieldNames,
	parentModels,
	currentResourceName,
	onOpenChange,
	onSave,
}: GeneratorFieldEditorSheetProps): React.JSX.Element {
	const [draft, setDraft] = React.useState<GeneratorFieldDraft | null>(field);
	const [nameError, setNameError] = React.useState<string | null>(null);

	React.useEffect(() => {
		setDraft(field);
		setNameError(null);
	}, [field]);

	const scalarType = draft?.entryType === "scalar" ? fieldKindToScalarType(draft.kind) : null;
	const supportsListBehavior = scalarType !== null && (fieldSupportsSearchable(scalarType) || fieldSupportsSortable(scalarType));
	const supportsFilter = scalarType !== null && fieldSupportsFilterable(scalarType);

	const handleSave = (): void => {
		if (draft === null) {
			return;
		}
		if (!isValidFieldName(draft.name)) {
			setNameError("Use camelCase starting with a lowercase letter (e.g. name, categoryId).");
			return;
		}
		const otherNames = new Set(existingFieldNames);
		if (field !== null) {
			otherNames.delete(field.name);
		}
		if (otherNames.has(draft.name)) {
			setNameError(`Column "${draft.name}" already exists on this resource.`);
			return;
		}
		if (draft.entryType === "scalar" && draft.kind === "enum") {
			if (draft.enumValues.length < 2) {
				setNameError("Enum fields need at least two values.");
				return;
			}
		}
		if (draft.entryType === "foreign-key" && (draft.relationModel === null || draft.relationModel.length === 0)) {
			setNameError("Select a parent table for the foreign key.");
			return;
		}
		onSave(draft);
		onOpenChange(false);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>{field === null ? "Add column" : "Edit column"}</SheetTitle>
					<SheetDescription>id, createdAt, and updatedAt are automatic — only add business columns here.</SheetDescription>
				</SheetHeader>

				{draft === null ? null : (
					<div className="grid gap-4 px-4">
						{draft.entryType === "foreign-key" ? (
							<div className="grid gap-2">
								<Label>Parent table</Label>
								<Select
									value={draft.relationModel ?? ""}
									onValueChange={(value) => {
										setDraft({ ...draft, relationModel: value });
									}}>
									<SelectTrigger>
										<SelectValue placeholder="Choose parent model" />
									</SelectTrigger>
									<SelectContent>
										{parentModels
											.filter((model) => model.modelName !== currentResourceName)
											.map((model) => (
												<SelectItem key={model.modelName} value={model.modelName}>
													{model.modelName}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>
						) : (
							<div className="grid gap-2">
								<Label>Column type</Label>
								<Select
									value={draft.kind}
									onValueChange={(value) => {
										const kind = SCALAR_KINDS.find((item) => item === value);
										if (kind === undefined) {
											return;
										}
										const type = fieldKindToScalarType(kind);
										setDraft({
											...draft,
											kind,
											required: type !== "text",
											nullable: type === "text",
											listBehavior: fieldSupportsSearchable(type) ? "search-sort" : fieldSupportsSortable(type) ? "sort-only" : "none",
											filterable: fieldSupportsFilterable(type),
											enumValues: kind === "enum" ? draft.enumValues : [],
										});
									}}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{SCALAR_KINDS.map((kind) => (
											<SelectItem key={kind} value={kind}>
												{fieldKindLabel(kind)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}

						<div className="grid gap-2">
							<Label htmlFor="field-name">Column name</Label>
							<Input
								id="field-name"
								value={draft.name}
								onChange={(event) => {
									setNameError(null);
									setDraft({ ...draft, name: event.target.value });
								}}
								placeholder="name, categoryId"
							/>
							{nameError !== null ? <p className="text-xs text-destructive">{nameError}</p> : null}
						</div>

						{draft.entryType === "foreign-key" ? (
							<div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
								<div>
									<Label>Optional parent link</Label>
									<p className="text-xs text-muted-foreground">Allow rows without a parent (nullable FK).</p>
								</div>
								<Switch
									checked={draft.relationOptional}
									onCheckedChange={(checked) => {
										setDraft({
											...draft,
											relationOptional: checked,
											required: !checked,
											nullable: checked,
										});
									}}
								/>
							</div>
						) : (
							<>
								<div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
									<div>
										<Label>Required on create</Label>
										<p className="text-xs text-muted-foreground">Reject creates when this column is missing.</p>
									</div>
									<Switch
										checked={draft.required}
										onCheckedChange={(checked) => {
											setDraft({
												...draft,
												required: checked,
												nullable: checked ? false : draft.nullable,
											});
										}}
									/>
								</div>

								{!draft.required ? (
									<div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
										<div>
											<Label>Allow null / empty</Label>
										</div>
										<Switch
											checked={draft.nullable}
											onCheckedChange={(checked) => {
												setDraft({ ...draft, nullable: checked });
											}}
										/>
									</div>
								) : null}

								{draft.kind === "enum" ? (
									<div className="grid gap-2">
										<Label htmlFor="enum-values">Pick-list values (comma-separated)</Label>
										<Input
											id="enum-values"
											value={draft.enumValues.join(", ")}
											onChange={(event) => {
												const values = event.target.value
													.split(",")
													.map((item) => item.trim())
													.filter((item) => item.length > 0);
												setDraft({ ...draft, enumValues: values });
											}}
											placeholder="draft, published, archived"
										/>
									</div>
								) : null}

								{supportsListBehavior ? (
									<div className="grid gap-2">
										<Label>List page behavior</Label>
										<Select
											value={draft.listBehavior}
											onValueChange={(value) => {
												const option = LIST_BEHAVIOR_OPTIONS.find((item) => item.value === value);
												if (option === undefined) {
													return;
												}
												setDraft({ ...draft, listBehavior: option.value });
											}}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{LIST_BEHAVIOR_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								) : null}

								{supportsFilter ? (
									<div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
										<div>
											<Label>Admin list filter</Label>
										</div>
										<Switch
											checked={draft.filterable}
											onCheckedChange={(checked) => {
												setDraft({ ...draft, filterable: checked });
											}}
										/>
									</div>
								) : null}
							</>
						)}
					</div>
				)}

				<SheetFooter className="mt-6">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							onOpenChange(false);
						}}>
						Cancel
					</Button>
					<Button type="button" onClick={handleSave}>
						Save column
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
});

GeneratorFieldEditorSheet.displayName = "GeneratorFieldEditorSheet";

export function openNewScalarFieldEditor(): GeneratorFieldDraft {
	return createDefaultScalarFieldDraft();
}

export function openNewForeignKeyFieldEditor(modelName: string): GeneratorFieldDraft {
	return createDefaultForeignKeyDraft(modelName);
}
