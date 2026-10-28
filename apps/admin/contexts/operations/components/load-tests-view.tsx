"use client";

// Load tests (ADR 068): start one (a scenario, the whole platform as a traffic mix, or one read
// endpoint), the runs with their verdicts, and — for a SuperAdmin — the caps and the purge.

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import {
	LOAD_TEST_ABORT_CPU_PERCENT,
	LOAD_TEST_ABORT_CPU_SECONDS,
	LOAD_TEST_ABORT_ERROR_PERCENT,
	LOAD_TEST_ABORT_ERROR_SECONDS,
	LOAD_TEST_SCENARIOS,
	LoadTestScenarioSchema,
	LoadTestShapeSchema,
	LoadTestTargetSchema,
	type LoadTestCaps,
	type LoadTestMixWeights,
	type LoadTestRun,
	type LoadTestScenario,
	type LoadTestShape,
	type LoadTestTarget,
} from "@workspace/shared";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { DataTable, type DataTableFeatures, type EmptyStateConfig } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";
import { useSuperAdminStatus } from "@/lib/session/super-admin";

import { formatCount, formatDateTimeShort, formatMs } from "../lib/ops-format";
import { describeRunTarget, LOAD_TEST_STATUS_PRESENTATION } from "../lib/load-test-presentation";
import { useNumberField, useTextField } from "../lib/use-ops-hooks";

const TARGET_LABELS: Readonly<Record<LoadTestTarget, string>> = { SCENARIO: "One scenario", MIX: "The whole platform (traffic mix)", ENDPOINT: "One read endpoint" };
const SHAPE_LABELS: Readonly<Record<LoadTestShape, string>> = {
	CONSTANT: "Constant — the full rate throughout",
	RAMP: "Ramp — up, hold, down",
	SPIKE: "Spike — a burst in the middle",
	SOAK: "Soak — long and steady",
};
const SECONDS_PER_MINUTE = 60;
/** The list refreshes quickly while a run is active. */
const ACTIVE_REFRESH_MS = 2_000;
const IDLE_REFRESH_MS = 30_000;

/** The numbers of a new run, as the form edits them. */
interface RunNumbers {
	readonly virtualUsers: number;
	readonly requestsPerSecond: number;
	readonly minutes: number;
	readonly thresholdP95Ms: number;
	readonly thresholdErrorPercent: number;
}

const DEFAULT_RUN_NUMBERS: RunNumbers = { virtualUsers: 50, requestsPerSecond: 100, minutes: 2, thresholdP95Ms: 300, thresholdErrorPercent: 1 };

/** One scenario's weight in a traffic mix. */
function WeightInput({
	scenario,
	value,
	onChange,
}: {
	readonly scenario: LoadTestScenario;
	readonly value: number;
	readonly onChange: (scenario: LoadTestScenario, value: number) => void;
}): React.JSX.Element {
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(scenario, Number(event.target.value));
		},
		[onChange, scenario],
	);
	return (
		<div className="flex items-center gap-2">
			<Input type="number" min={0} className="w-20" aria-label={`${LOAD_TEST_SCENARIOS[scenario].title} weight`} value={value} onChange={handleChange} />
			<span className="text-sm">{LOAD_TEST_SCENARIOS[scenario].title}</span>
		</div>
	);
}

/** A labelled number input. */
function NumberInput({
	id,
	label,
	value,
	min,
	max,
	step,
	onChange,
}: {
	readonly id: string;
	readonly label: string;
	readonly value: number;
	readonly min: number;
	readonly max?: number | undefined;
	readonly step?: string | undefined;
	readonly onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}): React.JSX.Element {
	return (
		<div className="space-y-1">
			<Label htmlFor={id}>{label}</Label>
			<Input id={id} type="number" min={min} max={max} step={step} value={value} onChange={onChange} />
		</div>
	);
}

function StartForm({
	caps,
	endpoints,
	onStarted,
}: {
	readonly caps: LoadTestCaps;
	readonly endpoints: readonly string[];
	readonly onStarted: (runId: string) => void;
}): React.JSX.Element {
	const { api } = useAuth();
	const [name, setName] = React.useState("");
	const [target, setTarget] = React.useState<LoadTestTarget>("SCENARIO");
	const [scenario, setScenario] = React.useState<LoadTestScenario>("browse-marketplace");
	const [endpoint, setEndpoint] = React.useState<string>(endpoints.at(0) ?? "");
	const [weights, setWeights] = React.useState<LoadTestMixWeights>(() =>
		Object.fromEntries(LoadTestScenarioSchema.options.map((key) => [key, LOAD_TEST_SCENARIOS[key].defaultWeight])),
	);
	const [shape, setShape] = React.useState<LoadTestShape>("RAMP");
	const [numbers, setNumbers] = React.useState<RunNumbers>(DEFAULT_RUN_NUMBERS);
	const start = api.operations.startLoadTest.useMutation({
		onSuccess: (result): void => {
			toastMessage.success({ title: "Load test queued" });
			onStarted(result.data.id);
		},
		onError: (error): void => {
			toastMutationError("Could not start the load test", error);
		},
	});
	const handleName = useTextField(setName);
	const handleEndpoint = useTextField(setEndpoint);
	const handleVirtualUsers = useNumberField(setNumbers, "virtualUsers");
	const handleRps = useNumberField(setNumbers, "requestsPerSecond");
	const handleMinutes = useNumberField(setNumbers, "minutes");
	const handleP95 = useNumberField(setNumbers, "thresholdP95Ms");
	const handleErrors = useNumberField(setNumbers, "thresholdErrorPercent");
	const handleTarget = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
		setTarget(LoadTestTargetSchema.parse(event.target.value));
	}, []);
	const handleScenario = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
		setScenario(LoadTestScenarioSchema.parse(event.target.value));
	}, []);
	const handleShape = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
		setShape(LoadTestShapeSchema.parse(event.target.value));
	}, []);
	const handleWeight = React.useCallback((key: LoadTestScenario, value: number): void => {
		setWeights((current) => ({ ...current, [key]: value }));
	}, []);
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			start.mutate({
				name: name.trim() === "" ? `${TARGET_LABELS[target]} ${new Date().toLocaleString()}` : name,
				target,
				scenario: target === "SCENARIO" ? scenario : null,
				endpoint: target === "ENDPOINT" ? endpoint : null,
				mixWeights: target === "MIX" ? weights : null,
				shape,
				virtualUsers: numbers.virtualUsers,
				requestsPerSecond: numbers.requestsPerSecond,
				durationSeconds: numbers.minutes * SECONDS_PER_MINUTE,
				thresholdP95Ms: numbers.thresholdP95Ms,
				thresholdErrorPercent: numbers.thresholdErrorPercent,
			});
		},
		[start, name, target, scenario, endpoint, weights, shape, numbers],
	);
	const maxMinutes = shape === "SOAK" ? caps.maxSoakMinutes : caps.maxMinutes;
	return (
		<Card>
			<CardHeader>
				<CardTitle>New load test</CardTitle>
				<CardDescription>
					It runs as load-test users of the Load Test tenant only. Up to {String(caps.maxVirtualUsers)} virtual users, {formatCount(caps.maxRequestsPerSecond)} requests a
					second and {String(maxMinutes)} minutes.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-1">
							<Label htmlFor="lt-name">Name</Label>
							<Input id="lt-name" value={name} onChange={handleName} placeholder="Marketplace before the release" maxLength={100} />
						</div>
						<div className="space-y-1">
							<Label htmlFor="lt-target">What to test</Label>
							<NativeSelect id="lt-target" value={target} onChange={handleTarget}>
								{LoadTestTargetSchema.options.map((option) => (
									<NativeSelectOption key={option} value={option}>
										{TARGET_LABELS[option]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</div>
						{target === "SCENARIO" ? (
							<div className="space-y-1 md:col-span-2">
								<Label htmlFor="lt-scenario">Scenario</Label>
								<NativeSelect id="lt-scenario" value={scenario} onChange={handleScenario}>
									{LoadTestScenarioSchema.options.map((option) => (
										<NativeSelectOption key={option} value={option}>
											{`${LOAD_TEST_SCENARIOS[option].title} — ${LOAD_TEST_SCENARIOS[option].description}`}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</div>
						) : null}
						{target === "ENDPOINT" ? (
							<div className="space-y-1 md:col-span-2">
								<Label htmlFor="lt-endpoint">Endpoint (read only)</Label>
								<NativeSelect id="lt-endpoint" value={endpoint} onChange={handleEndpoint}>
									{endpoints.map((option) => (
										<NativeSelectOption key={option} value={option}>
											{`GET ${option}`}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</div>
						) : null}
						{target === "MIX" ? (
							<fieldset className="space-y-2 md:col-span-2">
								<legend className="text-sm font-medium">Weights (share of the traffic)</legend>
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{LoadTestScenarioSchema.options.map((option) => (
										<WeightInput key={option} scenario={option} value={weights[option] ?? 0} onChange={handleWeight} />
									))}
								</div>
							</fieldset>
						) : null}
						<div className="space-y-1">
							<Label htmlFor="lt-shape">Shape</Label>
							<NativeSelect id="lt-shape" value={shape} onChange={handleShape}>
								{LoadTestShapeSchema.options.map((option) => (
									<NativeSelectOption key={option} value={option}>
										{SHAPE_LABELS[option]}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</div>
						<div className="grid grid-cols-3 gap-3">
							<NumberInput id="lt-vus" label="Virtual users" min={1} max={caps.maxVirtualUsers} value={numbers.virtualUsers} onChange={handleVirtualUsers} />
							<NumberInput id="lt-rps" label="Requests / s" min={1} max={caps.maxRequestsPerSecond} value={numbers.requestsPerSecond} onChange={handleRps} />
							<NumberInput id="lt-minutes" label="Minutes" min={1} max={maxMinutes} value={numbers.minutes} onChange={handleMinutes} />
						</div>
						<NumberInput id="lt-p95" label="Pass when p95 is at most (ms)" min={1} value={numbers.thresholdP95Ms} onChange={handleP95} />
						<NumberInput id="lt-errors" label="and errors at most (%)" min={0} max={100} step="0.1" value={numbers.thresholdErrorPercent} onChange={handleErrors} />
					</div>
					<p className="text-xs text-muted-foreground">
						It stops itself if errors stay above {String(LOAD_TEST_ABORT_ERROR_PERCENT)}% for {String(LOAD_TEST_ABORT_ERROR_SECONDS)} seconds or a server stays above{" "}
						{String(LOAD_TEST_ABORT_CPU_PERCENT)}% CPU for {String(LOAD_TEST_ABORT_CPU_SECONDS)} seconds. One load test runs at a time.
					</p>
					<Button type="submit" disabled={start.isPending}>
						<Rocket className="size-4" />
						{start.isPending ? "Starting…" : "Start load test"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function CapsForm({ caps }: { readonly caps: LoadTestCaps }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [draft, setDraft] = React.useState<LoadTestCaps>(caps);
	const save = api.operations.loadTestCaps.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Caps saved" });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.loadTests.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not save the caps", error);
		},
	});
	const purge = api.operations.purgeLoadTestData.useMutation({
		onSuccess: (result): void => {
			toastMessage.success({ title: `Purged ${formatCount(result.data.deletedRows)} rows` });
		},
		onError: (error): void => {
			toastMutationError("Could not purge", error);
		},
	});
	const handleVus = useNumberField(setDraft, "maxVirtualUsers");
	const handleRps = useNumberField(setDraft, "maxRequestsPerSecond");
	const handleMinutes = useNumberField(setDraft, "maxMinutes");
	const handleSoak = useNumberField(setDraft, "maxSoakMinutes");
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			save.mutate(draft);
		},
		[save, draft],
	);
	const handlePurge = React.useCallback((): void => {
		if (window.confirm("Permanently delete everything load tests created? This cannot be undone.")) {
			purge.mutate(undefined);
		}
	}, [purge]);
	return (
		<Card>
			<CardHeader>
				<CardTitle>Caps and data</CardTitle>
				<CardDescription>SuperAdmin: the most any load test may ask for, and removing what load tests created.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<form className="flex flex-wrap items-end gap-4" onSubmit={handleSubmit}>
					<NumberInput id="cap-vus" label="Virtual users" min={1} value={draft.maxVirtualUsers} onChange={handleVus} />
					<NumberInput id="cap-rps" label="Requests / s" min={1} value={draft.maxRequestsPerSecond} onChange={handleRps} />
					<NumberInput id="cap-minutes" label="Minutes" min={1} value={draft.maxMinutes} onChange={handleMinutes} />
					<NumberInput id="cap-soak" label="Soak minutes" min={1} value={draft.maxSoakMinutes} onChange={handleSoak} />
					<Button type="submit" disabled={save.isPending}>
						Save caps
					</Button>
				</form>
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-3">
					<p className="text-sm">Permanently delete the claims, sessions and other rows load tests created in the Load Test tenant. Runs and their results stay.</p>
					<Button type="button" variant="destructive" disabled={purge.isPending} onClick={handlePurge}>
						Purge load-test data
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function isActiveRun(run: LoadTestRun): boolean {
	return run.status === "QUEUED" || run.status === "RUNNING";
}

/** A run's compare tick box. */
function CompareToggle({ run, selected, onToggle }: { readonly run: LoadTestRun; readonly selected: boolean; readonly onToggle: (runId: string) => void }): React.JSX.Element {
	const handleToggle = React.useCallback((): void => {
		onToggle(run.id);
	}, [onToggle, run.id]);
	return <input type="checkbox" className="size-4 accent-primary" aria-label={`Compare ${run.name}`} checked={selected} onChange={handleToggle} />;
}

const RUNS_EMPTY: EmptyStateConfig = { title: "No load tests yet", description: "Start one above: it runs as load-test users of the Load Test tenant only." };
const RUN_SEARCH_KEYS: string[] = ["name", "requestedByName"];

function runColumns(selected: readonly string[], onToggle: (runId: string) => void): ColumnDef<DataTableFeatures, LoadTestRun>[] {
	return [
		{
			id: "compare",
			header: "Compare",
			enableSorting: false,
			cell: ({ row }) => <CompareToggle run={row.original} selected={selected.includes(row.original.id)} onToggle={onToggle} />,
		},
		{
			accessorKey: "name",
			header: "Run",
			cell: ({ row }) => (
				<div className="min-w-0">
					<Link href={ROUTES.operations.loadTest(row.original.id)} className="font-medium hover:underline">
						{row.original.name}
					</Link>
					<p className="text-xs text-muted-foreground">
						{describeRunTarget(row.original)} · {row.original.shape.toLowerCase()} · {String(row.original.virtualUsers)} users · {String(row.original.requestsPerSecond)} rps ·
						by {row.original.requestedByName}
					</p>
				</div>
			),
		},
		{
			accessorKey: "status",
			header: "Result",
			cell: ({ row }) => <StatusBadge tone={LOAD_TEST_STATUS_PRESENTATION[row.original.status].tone}>{LOAD_TEST_STATUS_PRESENTATION[row.original.status].label}</StatusBadge>,
		},
		{ accessorKey: "totalRequests", header: "Requests", cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.totalRequests)}</span> },
		{ accessorKey: "p95Ms", header: "p95", cell: ({ row }) => <span className="tabular-nums">{formatMs(row.original.p95Ms)}</span> },
		{
			accessorKey: "peakRps",
			header: "Peak rps",
			cell: ({ row }) => <span className="tabular-nums">{row.original.peakRps === null ? "—" : row.original.peakRps.toFixed(0)}</span>,
		},
		{
			accessorKey: "createdAt",
			header: "Started",
			cell: ({ row }) => <span className="tabular-nums">{formatDateTimeShort(row.original.startedAt ?? row.original.createdAt)}</span>,
		},
	];
}

export function LoadTestsView(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const { isSuperAdmin } = useSuperAdminStatus();
	const overview = api.operations.loadTests.useQuery(undefined, {
		staleTime: ACTIVE_REFRESH_MS,
		refetchInterval: (query): number => (query.state.data?.data.runs.some(isActiveRun) === true ? ACTIVE_REFRESH_MS : IDLE_REFRESH_MS),
	});
	const data = overview.data?.data;
	const [selected, setSelected] = React.useState<readonly string[]>([]);
	const handleToggle = React.useCallback((runId: string): void => {
		setSelected((current) => (current.includes(runId) ? current.filter((id) => id !== runId) : [...current, runId].slice(-2)));
	}, []);
	const handleStarted = React.useCallback(
		(runId: string): void => {
			router.push(ROUTES.operations.loadTest(runId));
		},
		[router],
	);
	const columns = React.useMemo(() => runColumns(selected, handleToggle), [selected, handleToggle]);
	const [left, right] = selected;
	const handleCompare = React.useCallback((): void => {
		if (left !== undefined && right !== undefined) {
			router.push(ROUTES.operations.compare(left, right));
		}
	}, [router, left, right]);
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Load tests</h1>
				<p className="text-sm text-muted-foreground">
					Synthetic traffic from the load runner, never from the API itself, against this deployment — with the servers&apos; load on the same timeline.
				</p>
			</header>
			{data !== undefined && !data.enabled ? (
				<Alert>
					<AlertTitle>Load testing is off here</AlertTitle>
					<AlertDescription>{data.disabledReason}</AlertDescription>
				</Alert>
			) : null}
			{data !== undefined && data.enabled ? <StartForm caps={data.caps} endpoints={data.endpoints} onStarted={handleStarted} /> : null}
			<Card>
				<CardHeader className="flex-row items-center justify-between gap-2">
					<div>
						<CardTitle>Runs</CardTitle>
						<CardDescription>Tick two runs to compare them side by side.</CardDescription>
					</div>
					{left !== undefined && right !== undefined ? (
						<Button type="button" variant="outline" onClick={handleCompare}>
							Compare
						</Button>
					) : null}
				</CardHeader>
				<CardContent>
					<DataTable
						columns={columns}
						data={data?.runs ?? []}
						searchKeys={RUN_SEARCH_KEYS}
						isLoading={overview.isLoading}
						emptyState={RUNS_EMPTY}
						persistKey="ops-load-tests"
					/>
				</CardContent>
			</Card>
			{isSuperAdmin && data !== undefined ? <CapsForm key={JSON.stringify(data.caps)} caps={data.caps} /> : null}
		</div>
	);
}
