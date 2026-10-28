"use client";

// Alerts (ADR 068): the open ones on top of the overview, every alert with its history here, and —
// for a SuperAdmin — the thresholds and who besides the SuperAdmins is emailed.

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { OPS_ALERT_RECIPIENT_LIMIT, OpsAlertStatusFilterSchema, type OpsAlert, type OpsAlertSettings, type OpsAlertStatusFilter } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { DataTable, type DataTableFeatures, type EmptyStateConfig } from "@workspace/ui/components/data-table";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { toastMessage } from "@workspace/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { useSuperAdminStatus } from "@/lib/session/super-admin";

import { formatDateTimeShort } from "../lib/ops-format";
import { ALERT_RULE_LABELS } from "./open-alerts-list";
import { useNumberField, useTextField } from "../lib/use-ops-hooks";
import { OPS_LIST_QUERY } from "../lib/ops-queries";

/** One numeric setting with its unit. */
export function NumberSetting({
	id,
	label,
	suffix,
	value,
	onChange,
}: {
	readonly id: string;
	readonly label: string;
	readonly suffix: string;
	readonly value: number;
	readonly onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}): React.JSX.Element {
	return (
		<div className="space-y-1">
			<Label htmlFor={id}>{label}</Label>
			<div className="flex items-center gap-2">
				<Input id={id} type="number" className="w-24" value={value} onChange={onChange} />
				<span className="text-sm text-muted-foreground">{suffix}</span>
			</div>
		</div>
	);
}

function AlertSettingsForm({ settings }: { readonly settings: OpsAlertSettings }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [draft, setDraft] = React.useState<OpsAlertSettings>(settings);
	const [recipients, setRecipients] = React.useState<string>(settings.extraRecipients.join(", "));
	const save = api.operations.updateAlertSettings.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Alert settings saved" });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.alertSettings.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not save the alert settings", error);
		},
	});
	const handleCpu = useNumberField(setDraft, "cpuPercent");
	const handleSustain = useNumberField(setDraft, "cpuSustainMinutes");
	const handleMemory = useNumberField(setDraft, "memoryPercent");
	const handleDisk = useNumberField(setDraft, "diskPercent");
	const handleSilent = useNumberField(setDraft, "silentAfterMinutes");
	const handleTls = useNumberField(setDraft, "tlsWarnDays");
	const handleRecipients = useTextField(setRecipients);
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const extraRecipients = recipients
				.split(",")
				.map((entry) => entry.trim())
				.filter((entry) => entry.length > 0)
				.slice(0, OPS_ALERT_RECIPIENT_LIMIT);
			save.mutate({ ...draft, extraRecipients });
		},
		[save, draft, recipients],
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle>Alert settings</CardTitle>
				<CardDescription>Every SuperAdmin is always emailed. Add anyone else who should be.</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<NumberSetting id="alert-cpu" label="CPU above" suffix="%" value={draft.cpuPercent} onChange={handleCpu} />
						<NumberSetting id="alert-sustain" label="for at least" suffix="minutes" value={draft.cpuSustainMinutes} onChange={handleSustain} />
						<NumberSetting id="alert-memory" label="Memory above" suffix="%" value={draft.memoryPercent} onChange={handleMemory} />
						<NumberSetting id="alert-disk" label="Disk above" suffix="%" value={draft.diskPercent} onChange={handleDisk} />
						<NumberSetting id="alert-silent" label="Silent for" suffix="minutes" value={draft.silentAfterMinutes} onChange={handleSilent} />
						<NumberSetting id="alert-tls" label="Certificate expires within" suffix="days" value={draft.tlsWarnDays} onChange={handleTls} />
					</div>
					<div className="space-y-1">
						<Label htmlFor="alert-recipients">Also email</Label>
						<Input id="alert-recipients" value={recipients} onChange={handleRecipients} placeholder="ops@example.com, oncall@example.com" />
					</div>
					<Button type="submit" disabled={save.isPending}>
						{save.isPending ? "Saving…" : "Save alert settings"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

const ALERT_COLUMNS: ColumnDef<DataTableFeatures, OpsAlert>[] = [
	{
		accessorKey: "message",
		header: "Alert",
		cell: ({ row }) => (
			<div className="min-w-0">
				<p className="font-medium">{row.original.message}</p>
				<p className="text-xs text-muted-foreground">{row.original.subjectName}</p>
			</div>
		),
	},
	{
		accessorKey: "rule",
		header: "Rule",
		cell: ({ row }) => <StatusBadge tone={row.original.resolvedAt === null ? "danger" : "muted"}>{ALERT_RULE_LABELS[row.original.rule]}</StatusBadge>,
	},
	{ accessorKey: "openedAt", header: "Opened", cell: ({ row }) => <span className="tabular-nums">{formatDateTimeShort(row.original.openedAt)}</span> },
	{
		accessorKey: "resolvedAt",
		header: "Resolved",
		cell: ({ row }) => <span className="tabular-nums">{row.original.resolvedAt === null ? "Open" : formatDateTimeShort(row.original.resolvedAt)}</span>,
	},
	{
		accessorKey: "peakValue",
		header: "Peak",
		cell: ({ row }) => <span className="tabular-nums">{row.original.peakValue === null ? "—" : row.original.peakValue.toFixed(0)}</span>,
	},
];
const ALERT_SEARCH_KEYS: string[] = ["message", "subjectName"];
const ALERTS_EMPTY: EmptyStateConfig = { title: "No alerts here", description: "Every server, instance and dependency is within its thresholds." };

export function OpsAlertsView(): React.JSX.Element {
	const { api } = useAuth();
	const { isSuperAdmin } = useSuperAdminStatus();
	const [status, setStatus] = React.useState<OpsAlertStatusFilter>("OPEN");
	const alerts = api.operations.alerts.useQuery({ status }, OPS_LIST_QUERY);
	const handleStatus = React.useCallback((value: string | number | null): void => {
		setStatus(OpsAlertStatusFilterSchema.parse(value));
	}, []);
	const settings = api.operations.alertSettings.useQuery(undefined, { staleTime: OPS_LIST_QUERY.staleTime });
	const rows = alerts.data?.data.alerts ?? [];
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
				<p className="text-sm text-muted-foreground">
					An alert opens when a server, instance, dependency or address crosses a threshold, and resolves when it recovers. Both are emailed.
				</p>
			</header>
			<Tabs value={status} onValueChange={handleStatus}>
				<TabsList>
					<TabsTrigger value="OPEN">Open</TabsTrigger>
					<TabsTrigger value="RESOLVED">Resolved</TabsTrigger>
					<TabsTrigger value="ALL">All</TabsTrigger>
				</TabsList>
			</Tabs>
			<DataTable
				columns={ALERT_COLUMNS}
				data={rows}
				searchKeys={ALERT_SEARCH_KEYS}
				isLoading={alerts.isLoading}
				isRefetching={alerts.isFetching ? !alerts.isLoading : false}
				emptyState={ALERTS_EMPTY}
				persistKey="ops-alerts"
			/>
			{isSuperAdmin && settings.data !== undefined ? <AlertSettingsForm key={JSON.stringify(settings.data.data)} settings={settings.data.data} /> : null}
		</div>
	);
}
