"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";
import {
	ConditionAttributeSchema,
	ConditionSchema,
	CreateFlagGroupSchema,
	RolloutUnitSchema,
	UpdateFlagGroupSchema,
	type ConditionAttribute,
	type ConditionInput,
	type FlagGroup,
	type RolloutUnit,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { FieldError } from "@workspace/ui/components/field";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import { Plus } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { CONDITION_ATTRIBUTE_LABELS, ROLLOUT_UNIT_LABELS } from "../lib/release-labels";
import { emptyCondition } from "./rule-editor/condition-editor";
import { ConditionRow } from "./rule-editor/rule-list-editor";

const RELEASES_SCOPE: readonly string[] = ["admin", "releases"];
const GroupKindSchema = z.enum(["CONDITIONS", "LIST"]);
type GroupKind = z.output<typeof GroupKindSchema>;
const GROUP_KINDS: readonly GroupKind[] = GroupKindSchema.options;
const KIND_LABELS: Readonly<Record<GroupKind, string>> = { CONDITIONS: "Conditions", LIST: "A list of subjects" };
/** A group's own conditions can't name another group. */
const GROUP_ATTRIBUTES: readonly ConditionAttribute[] = ConditionAttributeSchema.options.filter((attribute) => attribute !== "FLAG_GROUP");
/** A group's conditions name no group, so the group picker offers none. */
const NO_GROUP_KEYS: readonly string[] = [];

interface GroupFormValues {
	key: string;
	name: string;
	description: string;
	kind: GroupKind;
	unit: RolloutUnit;
	conditions: ConditionInput[];
	reason: string;
}

function kindLabel(kind: GroupKind): string {
	return KIND_LABELS[kind];
}

function attributeLabel(attribute: ConditionAttribute): string {
	return CONDITION_ATTRIBUTE_LABELS[attribute];
}

function selectKind(state: { readonly values: GroupFormValues }): GroupKind {
	return state.values.kind;
}

/** A condition group's conditions (controlled): each with its controls, and adding one. */
function GroupConditionsEditor({
	conditions,
	onChange,
}: {
	readonly conditions: readonly ConditionInput[];
	readonly onChange: (conditions: ConditionInput[]) => void;
}): React.JSX.Element {
	const [nextAttribute, setNextAttribute] = React.useState<ConditionAttribute>("PLATFORM_STAFF");
	const replace = React.useCallback(
		(index: number, next: ConditionInput): void => {
			onChange(conditions.map((existing, position) => (position === index ? next : existing)));
		},
		[conditions, onChange],
	);
	const remove = React.useCallback(
		(index: number): void => {
			onChange(conditions.filter((_existing, position) => position !== index));
		},
		[conditions, onChange],
	);
	const add = React.useCallback((): void => {
		onChange([...conditions, emptyCondition(nextAttribute, "")]);
	}, [conditions, nextAttribute, onChange]);
	return (
		<fieldset className="flex flex-col gap-3">
			<legend className="text-sm font-medium">A subject is in the group when all of these hold</legend>
			{conditions.map((condition, index): React.JSX.Element => (
				<ConditionRow
					key={`group-condition-${String(index)}-${condition.attribute}`}
					id="group"
					index={index}
					condition={condition}
					groupKeys={NO_GROUP_KEYS}
					onReplace={replace}
					onRemove={remove}
				/>
			))}
			<div className="flex flex-wrap items-end gap-2">
				<div className="min-w-56">
					<OptionSelectField
						id="group-next-condition"
						label="Add a condition on"
						value={nextAttribute}
						options={GROUP_ATTRIBUTES}
						labelOf={attributeLabel}
						onChange={setNextAttribute}
					/>
				</div>
				<Button type="button" variant="outline" size="sm" onClick={add}>
					<Plus className="size-4" />
					Add condition
				</Button>
			</div>
		</fieldset>
	);
}

const GroupFormShape = {
	key: z.string(),
	name: z.string(),
	description: z.string(),
	kind: GroupKindSchema,
	unit: RolloutUnitSchema,
	conditions: z.array(ConditionSchema),
	reason: z.string(),
};

/** Creating: the form → the create contract (a listed group's unit, or a condition group's conditions). */
export const CreateGroupFormSchema = z
	.object(GroupFormShape)
	.transform((form): z.input<typeof CreateFlagGroupSchema> => ({
		key: form.key.trim(),
		name: form.name,
		description: form.description,
		reason: form.reason,
		definition: form.kind === "LIST" ? { kind: "LIST", unit: form.unit } : { kind: "CONDITIONS", conditions: form.conditions },
	}))
	.pipe(CreateFlagGroupSchema);

/** Editing: the form → the update contract (a listed group keeps no conditions). */
export function editGroupFormSchema(kind: GroupKind): z.ZodType<z.output<typeof UpdateFlagGroupSchema>, GroupFormValues> {
	return z
		.object(GroupFormShape)
		.transform((form): z.input<typeof UpdateFlagGroupSchema> => ({
			name: form.name,
			description: form.description,
			conditions: kind === "LIST" ? null : form.conditions,
			reason: form.reason,
		}))
		.pipe(UpdateFlagGroupSchema);
}

function unitLabel(unit: RolloutUnit): string {
	return ROLLOUT_UNIT_LABELS[unit];
}

/** `/releases/groups/new` and `/releases/groups/[id]/edit` (ADR 087): a group's name, description and conditions. */
export function FlagGroupFormPage({ groupId }: { readonly groupId: string | null }): React.JSX.Element {
	const { api } = useAuth();
	const group = api.featureFlags.group.useQuery({ groupId: groupId ?? "" }, { enabled: groupId !== null }).data?.data;
	if (groupId !== null && group === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	return <GroupForm group={group ?? null} />;
}

function GroupForm({ group }: { readonly group: FlagGroup | null }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useProgressRouter();
	const done = async (saved: FlagGroup): Promise<void> => {
		toastMessage.success({ title: `${saved.name} saved` });
		await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
		router.push(ROUTES.releases.groups.detail(saved.id));
	};
	const create = api.featureFlags.createGroup.useMutation({
		onSuccess: (response) => done(response.data),
		onError: (error): void => {
			toastMutationError("Could not create the group", error);
		},
	});
	const update = api.featureFlags.updateGroup.useMutation({
		onSuccess: (response) => done(response.data),
		onError: (error): void => {
			toastMutationError("Could not save the group", error);
		},
	});
	const defaults: GroupFormValues = {
		key: group?.key ?? "",
		name: group?.name ?? "",
		description: group?.description ?? "",
		kind: group?.definition.kind ?? "CONDITIONS",
		unit: group?.definition.kind === "LIST" ? group.definition.unit : "USER",
		conditions: group?.definition.kind === "CONDITIONS" ? [...group.definition.conditions] : [],
		reason: "",
	};
	const editSchema = React.useMemo(() => (group === null ? null : editGroupFormSchema(group.definition.kind)), [group]);
	const [problem, setProblem] = React.useState<string | null>(null);
	const form = useForm({
		defaultValues: defaults,
		onSubmit: async ({ value }): Promise<void> => {
			// The whole form is checked at once: a group's problem can sit in a field this form doesn't show (its conditions).
			const parsed = editSchema === null ? CreateGroupFormSchema.safeParse(value) : editSchema.safeParse(value);
			setProblem(parsed.success ? null : z.prettifyError(parsed.error));
			if (!parsed.success) {
				return;
			}
			if (group === null) {
				await create.mutateAsync(CreateGroupFormSchema.parse(value));
			} else if (editSchema !== null) {
				await update.mutateAsync({ groupId: group.id, ...editSchema.parse(value) });
			}
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	const isNew = group === null;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">{isNew ? "New flag group" : `Edit: ${group.name}`}</h1>
				<p className="text-sm text-muted-foreground">Its key is what rules name; it never changes once the group exists.</p>
			</header>
			<form noValidate onSubmit={handleSubmit}>
				<Card>
					<CardHeader>
						<CardTitle>The group</CardTitle>
						<CardDescription>{isNew ? "A listed group gets its members on its own page once it exists." : "Change its name, description or conditions."}</CardDescription>
					</CardHeader>
					<CardContent className="flex max-w-3xl flex-col gap-4">
						{isNew ? (
							<form.Field name="key">
								{(field) => (
									<TextField
										id="group-key"
										label="Key"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
										placeholder="e.g. beta-testers"
									/>
								)}
							</form.Field>
						) : null}
						<form.Field name="name">
							{(field) => (
								<TextField id="group-name" label="Name" value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} errors={field.state.meta.errors} />
							)}
						</form.Field>
						<form.Field name="description">
							{(field) => (
								<TextField
									id="group-description"
									label="Description"
									multiline
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
								/>
							)}
						</form.Field>
						{isNew ? (
							<>
								<form.Field name="kind">
									{(field) => (
										<OptionSelectField id="group-kind" label="Kind" value={field.state.value} options={GROUP_KINDS} labelOf={kindLabel} onChange={field.handleChange} />
									)}
								</form.Field>
								<form.Subscribe selector={selectKind}>
									{(kind) =>
										kind === "LIST" ? (
											<form.Field name="unit">
												{(field) => (
													<OptionSelectField
														id="group-unit"
														label="It lists"
														value={field.state.value}
														options={RolloutUnitSchema.options}
														labelOf={unitLabel}
														onChange={field.handleChange}
													/>
												)}
											</form.Field>
										) : null
									}
								</form.Subscribe>
							</>
						) : null}
						<form.Subscribe selector={selectKind}>
							{(kind) =>
								kind === "CONDITIONS" ? (
									<form.Field name="conditions">{(field) => <GroupConditionsEditor conditions={field.state.value} onChange={field.handleChange} />}</form.Field>
								) : null
							}
						</form.Subscribe>
						<form.Field name="reason">
							{(field) => (
								<TextField
									id="group-reason"
									label="Why (kept in the audit log)"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
									placeholder="e.g. Staff try every change first"
								/>
							)}
						</form.Field>
						{problem === null ? null : <FieldError errors={[{ message: problem }]} />}
						<div>
							<Button type="submit" disabled={create.isPending || update.isPending}>
								{isNew ? "Create group" : "Save group"}
							</Button>
						</div>
					</CardContent>
				</Card>
			</form>
		</div>
	);
}
