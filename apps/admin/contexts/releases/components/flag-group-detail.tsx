"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { readPaginatedTotalPages } from "@workspace/client/lib/api/envelope";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";
import { ChangeFlagGroupMembersSchema, FLAG_GROUP_MAX_MEMBERS, PERMISSION, type FlagGroup } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { toastMessage } from "@workspace/ui/components/toast";
import { Pencil } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { z } from "zod";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { describeCondition, formatWhen, ROLLOUT_UNIT_LABELS } from "../lib/release-labels";
import { ReasonActionForm } from "./reason-action-form";
import { splitValues } from "./rule-editor/condition-editor";

const RELEASES_SCOPE: readonly string[] = ["admin", "releases"];
const MEMBERS_PER_PAGE = 25;
const FIRST_PAGE = 1;

const MemberActionSchema = z.enum(["ADD", "REMOVE"]);
type MemberAction = z.output<typeof MemberActionSchema>;
const MEMBER_ACTIONS: readonly MemberAction[] = MemberActionSchema.options;

const MemberFormSchema = z
	.object({ action: MemberActionSchema, ids: z.string(), reason: z.string() })
	.transform((form) => ({ action: form.action, subjectIds: splitValues(form.ids), reason: form.reason.trim() }))
	.pipe(ChangeFlagGroupMembersSchema);

const ACTION_LABELS: Readonly<Record<MemberAction, string>> = { ADD: "Add them", REMOVE: "Remove them" };

function actionLabel(action: MemberAction): string {
	return ACTION_LABELS[action];
}

/** `/releases/groups/[id]` (ADR 087): one flag group, read-only, with its members (listed groups) and removing it. */
export function FlagGroupDetailView({ groupId }: { readonly groupId: string }): React.JSX.Element {
	const { api } = useAuth();
	const group = api.featureFlags.group.useQuery({ groupId }).data?.data;
	if (group === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	return <GroupLoaded group={group} />;
}

function GroupLoaded({ group }: { readonly group: FlagGroup }): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const queryClient = useQueryClient();
	const router = useProgressRouter();
	const canChange = can(PERMISSION.FEATURE_FLAG_GROUP.UPDATE);
	const remove = api.featureFlags.removeGroup.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: `${group.name} removed` });
			await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
			router.push(ROUTES.releases.groups.list);
		},
		onError: (error): void => {
			toastMutationError("Could not remove the group", error);
		},
	});
	const { mutateAsync: removeAsync } = remove;
	const removeGroup = React.useCallback(
		async (reason: string): Promise<void> => {
			await removeAsync({ groupId: group.id, reason });
		},
		[group.id, removeAsync],
	);
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
					<p className="font-mono text-xs text-muted-foreground">{group.key}</p>
					<p className="max-w-3xl text-sm text-muted-foreground">{group.description}</p>
					<p className="text-sm text-muted-foreground">{`Last changed ${formatWhen(group.updatedAt)}${group.updatedByName === null ? "" : ` by ${group.updatedByName}`}`}</p>
				</div>
				{canChange ? (
					<Button render={<Link href={ROUTES.releases.groups.edit(group.id)} />} nativeButton={false}>
						<Pencil className="size-4" />
						Edit
					</Button>
				) : null}
			</header>
			<Card>
				<CardHeader>
					<CardTitle>{group.definition.kind === "LIST" ? `Listed ${ROLLOUT_UNIT_LABELS[group.definition.unit].toLowerCase()}s` : "Conditions"}</CardTitle>
					<CardDescription>
						{group.usedBy.length === 0 ? "No rule names this group." : `Named by the rules of ${group.usedBy.map((usage) => usage.key).join(", ")}.`}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{group.definition.kind === "CONDITIONS" ? (
						<ul className="flex flex-col gap-1 text-sm">
							{group.definition.conditions.map((condition, index): React.JSX.Element => (
								<li key={`${condition.attribute}-${String(index)}`}>{describeCondition(condition)}</li>
							))}
						</ul>
					) : (
						<MembersSection group={group} canChange={canChange} />
					)}
				</CardContent>
			</Card>
			{canChange && group.usedBy.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>Remove the group</CardTitle>
						<CardDescription>Its members go with it. Rules can&apos;t name it afterwards.</CardDescription>
					</CardHeader>
					<CardContent>
						<ReasonActionForm
							id={`remove-group-${group.id}`}
							label="Why remove it"
							submitLabel="Remove group"
							placeholder="e.g. The beta has ended"
							destructive
							pending={remove.isPending}
							onSubmit={removeGroup}
						/>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}

function MembersSection({ group, canChange }: { readonly group: FlagGroup; readonly canChange: boolean }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [page, setPage] = React.useState(FIRST_PAGE);
	const members = api.featureFlags.groupMembers.useQuery({ groupId: group.id, page, limit: MEMBERS_PER_PAGE }).data;
	const change = api.featureFlags.changeGroupMembers.useMutation({
		onSuccess: async (response): Promise<void> => {
			toastMessage.success({ title: `${String(response.data.changed)} changed`, description: `${String(response.data.memberCount)} in the group now.` });
			await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
		},
		onError: (error): void => {
			toastMutationError("Could not change the members", error);
		},
	});
	const previousPage = React.useCallback((): void => {
		setPage((current) => Math.max(FIRST_PAGE, current - 1));
	}, []);
	const nextPage = React.useCallback((): void => {
		setPage((current) => current + 1);
	}, []);
	const { mutateAsync } = change;
	const defaults: z.input<typeof MemberFormSchema> = { action: "ADD", ids: "", reason: "" };
	const form = useForm({
		defaultValues: defaults,
		validators: { onSubmit: MemberFormSchema },
		onSubmit: async ({ value, formApi }): Promise<void> => {
			await mutateAsync({ groupId: group.id, ...MemberFormSchema.parse(value) });
			formApi.reset();
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	const totalPages = readPaginatedTotalPages(members?.meta, FIRST_PAGE);
	return (
		<div className="flex flex-col gap-6">
			<p className="text-sm text-muted-foreground">{`${String(group.memberCount)} of at most ${FLAG_GROUP_MAX_MEMBERS.toLocaleString("en-GB")}.`}</p>
			{members === undefined ? (
				<Skeleton className="h-32 w-full rounded-xl" />
			) : members.data.length === 0 ? (
				<p className="text-sm text-muted-foreground">Nobody listed yet.</p>
			) : (
				<Table aria-label="Members">
					<TableHeader>
						<TableRow>
							<TableHead>Member</TableHead>
							<TableHead>Added</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{members.data.map((member): React.JSX.Element => (
							<TableRow key={member.subjectId}>
								<TableCell>
									{member.name ?? "—"}
									<p className="font-mono text-xs text-muted-foreground">{member.subjectId}</p>
								</TableCell>
								<TableCell className="whitespace-nowrap">
									{formatWhen(member.addedAt)}
									<p className="text-xs text-muted-foreground">{member.addedByName ?? ""}</p>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
			<div className="flex items-center gap-2">
				<Button type="button" variant="outline" size="sm" disabled={page <= FIRST_PAGE} onClick={previousPage}>
					Previous
				</Button>
				<span className="text-sm text-muted-foreground">{`Page ${String(page)} of ${String(totalPages)}`}</span>
				<Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={nextPage}>
					Next
				</Button>
			</div>
			{canChange ? (
				<form noValidate className="flex flex-col gap-3 border-t border-border pt-4" onSubmit={handleSubmit} aria-label="Change the members">
					<form.Field name="action">
						{(field) => (
							<OptionSelectField
								id="members-action"
								label="What to do"
								value={field.state.value}
								options={MEMBER_ACTIONS}
								labelOf={actionLabel}
								onChange={field.handleChange}
							/>
						)}
					</form.Field>
					<form.Field name="ids">
						{(field) => (
							<TextField
								id="members-ids"
								label="Ids (up to 1,000, separated by commas or new lines)"
								multiline
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								errors={field.state.meta.errors}
							/>
						)}
					</form.Field>
					<form.Field name="reason">
						{(field) => (
							<TextField
								id="members-reason"
								label="Why (kept in the audit log)"
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								errors={field.state.meta.errors}
								placeholder="e.g. New beta sign-ups this week"
							/>
						)}
					</form.Field>
					<div>
						<Button type="submit" size="sm" disabled={change.isPending}>
							Apply
						</Button>
					</div>
				</form>
			) : null}
		</div>
	);
}
