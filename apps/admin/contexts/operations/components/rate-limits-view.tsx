"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	describeRateLimitAllowance,
	PERMISSION,
	SetTenantRateLimitOverrideSchema,
	TenantRateLimitPolicyNameSchema,
	type RateLimitedSubject,
	type RateLimitPolicySummary,
	type SetTenantRateLimitOverrideInput,
	type TenantRateLimitOverride,
	type TenantRateLimitPolicyName,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { toastMessage } from "@workspace/ui/components/toast";
import { addDays, format } from "date-fns";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";

import { formatDateTimeShort } from "../lib/ops-format";

/** Policies a tenant override can raise or lower, in the words staff use. */
export const TENANT_POLICY_LABELS: Readonly<Record<TenantRateLimitPolicyName, string>> = {
	TENANT_TRAFFIC: "Tenant API traffic",
	API_KEY_TRAFFIC: "POS API key traffic",
	TENANT_BROADCASTS: "Broadcasts per week",
};

const POLICY_OPTIONS: readonly SelectOption<TenantRateLimitPolicyName>[] = TenantRateLimitPolicyNameSchema.options.map((value) => ({
	value,
	label: TENANT_POLICY_LABELS[value],
}));

/** An override lasts this long unless staff pick another end. */
const DEFAULT_OVERRIDE_DAYS = 30;

/** The override form as staff type it: numbers as text, the end as a date. */
export interface OverrideDraft {
	readonly tenantId: string;
	readonly policyName: TenantRateLimitPolicyName;
	readonly ratePerSecond: string;
	readonly burst: string;
	readonly perWeek: string;
	readonly expiresOn: string;
	readonly reason: string;
}

/** The typed form → the API's input (validated by the shared schema), or the first problem in words. */
export function toOverrideInput(
	draft: OverrideDraft,
): { readonly ok: true; readonly input: SetTenantRateLimitOverrideInput } | { readonly ok: false; readonly message: string } {
	const expiresAt = Date.parse(`${draft.expiresOn}T23:59:59Z`);
	const candidate =
		draft.policyName === "TENANT_BROADCASTS"
			? { tenantId: draft.tenantId.trim(), policyName: draft.policyName, perWeek: Number(draft.perWeek), expiresAt, reason: draft.reason }
			: {
					tenantId: draft.tenantId.trim(),
					policyName: draft.policyName,
					ratePerSecond: Number(draft.ratePerSecond),
					burst: Number(draft.burst),
					expiresAt,
					reason: draft.reason,
				};
	const parsed = SetTenantRateLimitOverrideSchema.safeParse(candidate);
	if (parsed.success) {
		return { ok: true, input: parsed.data };
	}
	const [issue] = parsed.error.issues;
	const field = issue?.path.join(".") ?? "";
	return { ok: false, message: field.length === 0 ? (issue?.message ?? "Check the form.") : `${field}: ${issue?.message ?? "invalid"}` };
}

/** `/operations/rate-limits` (ADR 071): every policy and its refusals, the subjects hitting them, tenant overrides. */
export function RateLimitsView(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const overviewQuery = api.operations.rateLimits.useQuery(undefined);
	const overridesQuery = api.operations.rateLimitOverrides.useQuery(undefined);
	const canChange = can(PERMISSION.RATE_LIMIT.UPDATE);
	const overview = overviewQuery.data?.data;

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">Rate limits</h1>
				<p className="text-sm text-muted-foreground">How often each caller may call the API, who is being refused right now, and the tenants with their own limits.</p>
			</header>
			{overview === undefined ? (
				<Skeleton className="h-64 w-full rounded-xl" />
			) : (
				<>
					<PoliciesCard policies={overview.policies} />
					<SubjectsCard subjects={overview.topSubjects} canChange={canChange} />
					{overview.exemptions.length === 0 ? null : (
						<p className="text-sm text-muted-foreground">Never limited: {overview.exemptions.map((exemption) => exemption.label).join(", ")}.</p>
					)}
				</>
			)}
			<OverridesCard overrides={overridesQuery.data?.data} canChange={canChange} />
		</div>
	);
}

function PoliciesCard({ policies }: { readonly policies: readonly RateLimitPolicySummary[] }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Policies</CardTitle>
				<CardDescription>Refusals in the last hour; a policy that fails closed refuses when Redis is down.</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Policy</TableHead>
							<TableHead>Limit</TableHead>
							<TableHead>Counts per</TableHead>
							<TableHead>If Redis is down</TableHead>
							<TableHead className="text-end">Refused (1h)</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{policies.map((policy): React.JSX.Element => (
							<TableRow key={policy.name}>
								<TableCell className="font-medium">
									{policy.name}
									{policy.penalty ? <span className="ms-2 text-xs text-muted-foreground">penalty</span> : null}
								</TableCell>
								<TableCell>{policy.limit}</TableCell>
								<TableCell>{policy.subject}</TableCell>
								<TableCell>
									<StatusBadge tone={policy.failMode === "closed" ? "warning" : "muted"}>{policy.failMode === "closed" ? "Refuses" : "Allows"}</StatusBadge>
								</TableCell>
								<TableCell className="text-end tabular-nums">{policy.refusedLastHour}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

function SubjectsCard({ subjects, canChange }: { readonly subjects: readonly RateLimitedSubject[]; readonly canChange: boolean }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Refused most</CardTitle>
				<CardDescription>The callers refused most in the last hour (masked). A penalty blocks a caller for a while after repeated abuse.</CardDescription>
			</CardHeader>
			<CardContent>
				{subjects.length === 0 ? (
					<p className="text-sm text-muted-foreground">No one is being refused.</p>
				) : (
					<ul className="flex flex-col divide-y divide-border">
						{subjects.map((subject): React.JSX.Element => (
							<li key={`${subject.policyName}:${subject.subjectRef}`}>
								<SubjectRow subject={subject} canChange={canChange} />
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

/** Lifting a penalty is audited, so it asks why. */
const LIFT_REASON = "Lifted from the rate limits page after review";

function SubjectRow({ subject, canChange }: { readonly subject: RateLimitedSubject; readonly canChange: boolean }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const lift = api.operations.liftRateLimitPenalty.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Penalty lifted" });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.rateLimits.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not lift the penalty", error);
		},
	});
	const { mutate } = lift;
	const handleLift = React.useCallback((): void => {
		mutate({ subjectRef: subject.subjectRef, reason: LIFT_REASON });
	}, [mutate, subject.subjectRef]);
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 py-3">
			<div className="flex min-w-0 flex-col">
				<span className="font-mono text-sm">{subject.maskedSubject}</span>
				<span className="text-xs text-muted-foreground">
					{subject.policyName} · {subject.subjectKind} · {subject.refusals} refused
				</span>
			</div>
			{subject.penalized ? (
				<div className="flex items-center gap-2">
					<StatusBadge tone="danger">Penalised</StatusBadge>
					{canChange ? (
						<Button type="button" size="sm" variant="outline" onClick={handleLift} disabled={lift.isPending}>
							Lift penalty
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function OverridesCard({ overrides, canChange }: { readonly overrides: readonly TenantRateLimitOverride[] | undefined; readonly canChange: boolean }): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Tenant overrides</CardTitle>
				<CardDescription>A tenant with its own limit for a while — a busy launch, a large POS fleet, more broadcasts.</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{overrides === undefined ? (
					<Skeleton className="h-24 w-full" />
				) : overrides.length === 0 ? (
					<p className="text-sm text-muted-foreground">No tenant has its own limit.</p>
				) : (
					<ul className="flex flex-col divide-y divide-border">
						{overrides.map((override): React.JSX.Element => (
							<li key={override.id}>
								<OverrideRow override={override} canChange={canChange} />
							</li>
						))}
					</ul>
				)}
				{canChange ? <OverrideForm /> : null}
			</CardContent>
		</Card>
	);
}

function useInvalidateOverrides(): () => Promise<void> {
	const queryClient = useQueryClient();
	return React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.operations.rateLimitOverrides.queryKey(undefined) });
	}, [queryClient]);
}

function OverrideRow({ override, canChange }: { readonly override: TenantRateLimitOverride; readonly canChange: boolean }): React.JSX.Element {
	const { api } = useAuth();
	const invalidate = useInvalidateOverrides();
	const remove = api.operations.removeRateLimitOverride.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Override removed", description: "The tenant is back on the standard limit." });
			await invalidate();
		},
		onError: (error): void => {
			toastMutationError("Could not remove the override", error);
		},
	});
	const { mutate } = remove;
	const handleRemove = React.useCallback((): void => {
		mutate({ overrideId: override.id });
	}, [mutate, override.id]);
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 py-3">
			<div className="flex min-w-0 flex-col">
				<span className="text-sm font-medium">
					{override.tenantName} · {TENANT_POLICY_LABELS[override.policyName]}
				</span>
				<span className="text-xs text-muted-foreground">
					{describeRateLimitAllowance(override.policyName, override)} · until {formatDateTimeShort(override.expiresAt)} · {override.reason}
				</span>
			</div>
			{canChange ? (
				<Button type="button" size="sm" variant="outline" onClick={handleRemove} disabled={remove.isPending}>
					Remove
				</Button>
			) : null}
		</div>
	);
}

function OverrideForm(): React.JSX.Element {
	const { api } = useAuth();
	const invalidate = useInvalidateOverrides();
	const [draft, setDraft] = React.useState<OverrideDraft>(() => ({
		tenantId: "",
		policyName: "TENANT_TRAFFIC",
		ratePerSecond: "50",
		burst: "200",
		perWeek: "10",
		expiresOn: format(addDays(new Date(), DEFAULT_OVERRIDE_DAYS), "yyyy-MM-dd"),
		reason: "",
	}));
	const [problem, setProblem] = React.useState<string | null>(null);
	const save = api.operations.setRateLimitOverride.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Override saved", description: "It applies within a minute." });
			setDraft((current) => ({ ...current, tenantId: "", reason: "" }));
			await invalidate();
		},
		onError: (error): void => {
			toastMutationError("Could not save the override", error);
		},
	});
	const handleText = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		const { name, value } = event.currentTarget;
		setDraft((current) => ({ ...current, [name]: value }));
	}, []);
	const handlePolicy = React.useCallback((value: string | null): void => {
		const parsed = TenantRateLimitPolicyNameSchema.safeParse(value);
		if (parsed.success) {
			setDraft((current) => ({ ...current, policyName: parsed.data }));
		}
	}, []);
	const handleExpires = React.useCallback((expiresOn: string): void => {
		setDraft((current) => ({ ...current, expiresOn }));
	}, []);
	const { mutate } = save;
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const result = toOverrideInput(draft);
			setProblem(result.ok ? null : result.message);
			if (result.ok) {
				mutate(result.input);
			}
		},
		[draft, mutate],
	);
	const isBroadcasts = draft.policyName === "TENANT_BROADCASTS";

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-4" aria-label="Set an override">
			<p className="text-sm font-medium">Set an override</p>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="override-tenant">Tenant ID</Label>
					<Input id="override-tenant" name="tenantId" value={draft.tenantId} onChange={handleText} placeholder="From the merchant's page" />
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="override-policy">Policy</Label>
					<Select<TenantRateLimitPolicyName> items={POLICY_OPTIONS} value={draft.policyName} onValueChange={handlePolicy}>
						<SelectTrigger id="override-policy">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{POLICY_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{isBroadcasts ? (
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="override-per-week">Broadcasts per week</Label>
						<Input id="override-per-week" name="perWeek" type="number" inputMode="numeric" value={draft.perWeek} onChange={handleText} />
					</div>
				) : (
					<>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="override-rate">Requests per second</Label>
							<Input id="override-rate" name="ratePerSecond" type="number" inputMode="numeric" value={draft.ratePerSecond} onChange={handleText} />
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="override-burst">Burst</Label>
							<Input id="override-burst" name="burst" type="number" inputMode="numeric" value={draft.burst} onChange={handleText} />
						</div>
					</>
				)}
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="override-expires">Until</Label>
					<DatePicker id="override-expires" value={draft.expiresOn} onValueChange={handleExpires} placeholder="Pick the last day" />
				</div>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="override-reason">Why (kept in the audit log)</Label>
				<Input id="override-reason" name="reason" value={draft.reason} onChange={handleText} placeholder="e.g. Launch week for 40 new tills" />
			</div>
			{problem === null ? null : (
				<p role="alert" className="text-sm text-destructive">
					{problem}
				</p>
			)}
			<Button type="submit" className="w-fit" disabled={save.isPending}>
				{save.isPending ? "Saving…" : "Save override"}
			</Button>
		</form>
	);
}
