"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { PERMISSION, type TierSettingsResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import {
	checkTierSettings,
	TIER_RULE_FIELDS,
	TierSettingsDraftFieldSchema,
	toTierSettingsDraft,
	withDraftField,
	type TierRuleField,
	type TierSettingsDraft,
} from "@/contexts/tiers/lib/tier-settings-form";
import { toastMutationError } from "@/lib/api/mutation-error";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** `/settings/tiers` (ADR 085): the customer tier rules, who last changed them and why, and changing them with a reason. */
export function TierSettingsView(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const settings = api.tiers.settings.useQuery(undefined).data?.data;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h2 className="text-xl font-semibold tracking-tight">Customer tiers</h2>
				<p className="text-sm text-muted-foreground">
					How customers move between Bronze, Silver, Gold and Diamond. A change applies at the next nightly review: warnings go out first, and nobody drops a tier without one.
				</p>
			</header>
			{settings === undefined ? <Skeleton className="h-72 w-full rounded-xl" /> : <TierSettingsCard settings={settings} canChange={can(PERMISSION.SYSTEM_SETTINGS.UPDATE)} />}
		</div>
	);
}

function TierSettingsCard({ settings, canChange }: { readonly settings: TierSettingsResponse; readonly canChange: boolean }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Rules</CardTitle>
				<CardDescription>
					{settings.updatedAt === null
						? "The launch rules: nobody has changed them yet."
						: `Last changed ${DATE.format(settings.updatedAt)}${settings.updatedByName === null ? "" : ` by ${settings.updatedByName}`}${settings.reason === null ? "" : `: ${settings.reason}`}`}
				</CardDescription>
			</CardHeader>
			<CardContent>{canChange ? <TierSettingsForm settings={settings} /> : <TierRulesList settings={settings} />}</CardContent>
		</Card>
	);
}

/** The rules, read-only (staff who may not change them). */
function TierRulesList({ settings }: { readonly settings: TierSettingsResponse }): React.JSX.Element {
	return (
		<dl className="grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
			{TIER_RULE_FIELDS.map((entry) => (
				<React.Fragment key={entry.field}>
					<dt className="text-muted-foreground">{entry.label}</dt>
					<dd className="tabular-nums">{String(settings[entry.field])}</dd>
				</React.Fragment>
			))}
		</dl>
	);
}

function TierSettingsForm({ settings }: { readonly settings: TierSettingsResponse }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [draft, setDraft] = React.useState<TierSettingsDraft>(() => toTierSettingsDraft(settings));
	const [submitted, setSubmitted] = React.useState(false);
	const update = api.tiers.updateSettings.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Tier rules saved", description: "They apply at the next nightly review." });
			setDraft((current) => ({ ...current, reason: "" }));
			setSubmitted(false);
			await queryClient.invalidateQueries({ queryKey: apiRouter.tiers.settings.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not save the tier rules", error);
		},
	});
	const check = checkTierSettings(draft);
	const errors = submitted && !check.ok ? check.errors : {};
	const { mutate } = update;
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setSubmitted(true);
			const result = checkTierSettings(draft);
			if (result.ok) {
				mutate(result.input);
			}
		},
		[draft, mutate],
	);
	const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		const { name, value } = event.currentTarget;
		const field = TierSettingsDraftFieldSchema.safeParse(name);
		if (field.success) {
			setDraft((current) => withDraftField(current, field.data, value));
		}
	}, []);

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit} aria-label="Change the tier rules" noValidate>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{TIER_RULE_FIELDS.map((entry) => (
					<RuleField
						key={entry.field}
						field={entry.field}
						label={entry.label}
						hint={entry.hint}
						value={draft[entry.field]}
						error={errors[entry.field]}
						onChange={handleChange}
					/>
				))}
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="tier-reason">Why (kept in the audit log)</Label>
				<Input
					id="tier-reason"
					name="reason"
					value={draft.reason}
					onChange={handleChange}
					placeholder="e.g. Gold was too easy to reach in the pilot"
					aria-invalid={errors.reason !== undefined}
				/>
				{errors.reason === undefined ? null : <p className="text-xs text-destructive">{errors.reason}</p>}
			</div>
			<div>
				<Button type="submit" size="sm" disabled={update.isPending}>
					Save rules
				</Button>
			</div>
		</form>
	);
}

interface RuleFieldProps {
	readonly field: TierRuleField;
	readonly label: string;
	readonly hint: string;
	readonly value: string;
	readonly error: string | undefined;
	readonly onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function RuleField({ field, label, hint, value, error, onChange }: RuleFieldProps): React.JSX.Element {
	const id = `tier-${field}`;
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			<Input id={id} name={field} type="number" inputMode="numeric" value={value} onChange={onChange} aria-invalid={error !== undefined} aria-describedby={`${id}-hint`} />
			<p id={`${id}-hint`} className="text-xs text-muted-foreground">
				{hint}
			</p>
			{error === undefined ? null : <p className="text-xs text-destructive">{error}</p>}
		</div>
	);
}
