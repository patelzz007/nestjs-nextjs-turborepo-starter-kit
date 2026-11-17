"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";
import { ChangeReasonSchema, FlagRulesSchema, type FeatureFlagDetail, type FeatureFlagKey, type FlagRule, type FlagRuleInput } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { FieldError } from "@workspace/ui/components/field";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import { z } from "zod";

import { TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { EnvironmentNote } from "./environment-note";
import { newFlagRule, RuleListEditor } from "./rule-editor/rule-list-editor";

const RELEASES_SCOPE: readonly string[] = ["admin", "releases"];

/** The editor's value → the shared save contract (the API checks the same, and the groups exist). */
export const FlagRulesFormSchema = z.object({ rules: FlagRulesSchema, reason: ChangeReasonSchema });

interface FlagRulesFormValues {
	rules: FlagRuleInput[];
	reason: string;
}

/** `/releases/flags/[key]/edit` (ADR 087): the flag's rules, saved as its next revision with a reason. */
export function FlagRulesFormPage({ flagKey }: { readonly flagKey: FeatureFlagKey }): React.JSX.Element {
	const { api } = useAuth();
	const flag = api.featureFlags.detail.useQuery({ key: flagKey }).data?.data;
	const groups = api.featureFlags.groups.useQuery(undefined).data?.data.groups;
	if (flag === undefined || groups === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	return <FlagRulesForm flag={flag} groupKeys={groups.map((group) => group.key)} />;
}

function liveRules(flag: FeatureFlagDetail): FlagRule[] {
	return flag.live?.content.kind === "FLAG" ? [...flag.live.content.rules] : [];
}

function FlagRulesForm({ flag, groupKeys }: { readonly flag: FeatureFlagDetail; readonly groupKeys: readonly string[] }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useProgressRouter();
	const save = api.featureFlags.saveRevision.useMutation({
		onSuccess: async (response): Promise<void> => {
			const revision = response.data;
			toastMessage.success({
				title:
					revision.status === "LIVE" ? `${flag.title}: revision ${String(revision.number)} is live` : `${flag.title}: change ${String(revision.number)} waits for approval`,
			});
			await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
			router.push(ROUTES.releases.flag(flag.key));
		},
		onError: (error): void => {
			toastMutationError("Could not save the rules", error);
		},
	});
	const { mutateAsync } = save;
	const defaults: FlagRulesFormValues = { rules: liveRules(flag), reason: "" };
	const form = useForm({
		defaultValues: defaults,
		validators: { onSubmit: FlagRulesFormSchema },
		onSubmit: async ({ value }): Promise<void> => {
			const parsed = FlagRulesFormSchema.parse(value);
			await mutateAsync({ key: flag.key, rules: parsed.rules, reason: parsed.reason, basedOn: flag.live?.number ?? null });
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">{`Edit rules: ${flag.title}`}</h1>
				<p className="text-sm text-muted-foreground">
					{`Rules are tried in order; the first one a subject matches decides. Anyone no rule matches gets the code default (${flag.defaultOn ? "on" : "off"}).`}
				</p>
				<EnvironmentNote />
			</header>
			<form noValidate className="flex flex-col gap-6" onSubmit={handleSubmit}>
				<form.Field name="rules">
					{(field) => (
						<div className="flex flex-col gap-2">
							<RuleListEditor rules={field.state.value} onChange={field.handleChange} groupKeys={groupKeys} newRule={newFlagRule} />
							<FieldError errors={[...field.state.meta.errors]} />
						</div>
					)}
				</form.Field>
				<Card>
					<CardHeader>
						<CardTitle>Save as the next revision</CardTitle>
						<CardDescription>The earlier rules stay in the history; nothing is overwritten.</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<form.Field name="reason">
							{(field) => (
								<TextField
									id="flag-rules-reason"
									label="Why (kept in the audit log)"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
									placeholder="e.g. Beta testers first, then everyone next week"
								/>
							)}
						</form.Field>
						<div>
							<Button type="submit" disabled={save.isPending}>
								Save rules
							</Button>
						</div>
					</CardContent>
				</Card>
			</form>
		</div>
	);
}
