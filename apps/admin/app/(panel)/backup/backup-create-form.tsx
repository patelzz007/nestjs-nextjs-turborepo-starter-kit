"use client";

import type { BackupEntry, BackupListResponse, BackupOptionsResponse } from "@workspace/shared";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@workspace/ui/components/form/button";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Slider } from "@workspace/ui/components/form/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { CheckSquare, DatabaseBackup, HardDrive, Loader2, Settings2, SquareDashedMousePointer, Timer, TriangleAlert, Zap } from "lucide-react";

import { BackupExcludeTableCheckbox } from "./backup-exclude-checkbox";
import { BackupQuotaChip } from "./backup-quota-chip";
import { estimateBackupTime, formatBytes, LARGE_DB_THRESHOLD_BYTES } from "./backup-copy";

export interface BackupCreateFormProps {
	readonly backupName: string;
	readonly compressLevel: number;
	readonly schemaOnly: boolean;
	readonly excluded: readonly string[];
	readonly formDisabled: boolean;
	readonly createPending: boolean;
	readonly isDefaultSelection: boolean;
	readonly rateLimit: BackupListResponse["rateLimit"];
	readonly options: BackupOptionsResponse | undefined;
	readonly lastCompleted: BackupEntry | undefined;
	readonly activeBackup: BackupEntry | undefined;
	readonly onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
	readonly onBackupNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	readonly onCompressChange: (value: number | readonly number[]) => void;
	readonly onSchemaOnlyChange: (checked: boolean) => void;
	readonly onSelectAllTables: () => void;
	readonly onClearExcluded: () => void;
	readonly onRestoreDefaults: () => void;
	readonly onExcludeTableToggle: (name: string, checked: boolean) => void;
}

export function BackupCreateForm({
	backupName,
	compressLevel,
	schemaOnly,
	excluded,
	formDisabled,
	createPending,
	isDefaultSelection,
	rateLimit,
	options,
	lastCompleted,
	activeBackup,
	onSubmit,
	onBackupNameChange,
	onCompressChange,
	onSchemaOnlyChange,
	onSelectAllTables,
	onClearExcluded,
	onRestoreDefaults,
	onExcludeTableToggle,
}: BackupCreateFormProps): React.JSX.Element {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Create a backup</CardTitle>
				<CardDescription>One job at a time — the form locks while a backup is running.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit} className="space-y-5">
					<div className="grid gap-5 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="backup-name">Name (optional)</Label>
							<Input
								id="backup-name"
								value={backupName}
								onChange={onBackupNameChange}
								placeholder="e.g. before_billing_migration"
								disabled={formDisabled}
								autoComplete="off"
								maxLength={50}
							/>
							<p className="text-xs text-muted-foreground">Letters, numbers, underscore and hyphen only — auto-generated when left blank.</p>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="compress-level">Compression level</Label>
								<span className="font-mono text-sm text-muted-foreground tabular-nums">{compressLevel} / 9</span>
							</div>
							<Slider id="compress-level" min={1} max={9} step={1} value={[compressLevel]} onValueChange={onCompressChange} disabled={formDisabled} />
							<p className="text-xs text-muted-foreground">Lower = faster but bigger files; higher = slower but smaller.</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-2">
						<label className="flex cursor-pointer items-center gap-2">
							<Checkbox id="schema-only" checked={schemaOnly} disabled={formDisabled} onCheckedChange={onSchemaOnlyChange} />
							<span className="text-sm">Schema only</span>
						</label>
						<p className="text-xs text-muted-foreground">Structure without data — a much smaller, faster dump for migrations and schema review.</p>
					</div>

					{rateLimit !== null ? (
						<div className="flex flex-wrap items-center justify-between gap-2">
							<BackupQuotaChip limit={rateLimit.limit} used={rateLimit.used} resetsAt={rateLimit.resetsAt} />
							<p className="text-xs text-muted-foreground">The hourly cap keeps one admin from flooding the single-job queue.</p>
						</div>
					) : null}

					{options !== undefined && options.dbSizeBytes !== null ? (
						<div className="rounded-md border border-border bg-muted/30 p-3">
							<div className="flex flex-wrap items-center gap-3">
								<div className="flex items-center gap-1.5 text-sm">
									<HardDrive className="size-4 text-muted-foreground" />
									<span className="font-medium">Database size:</span>
									<span className="tabular-nums">{formatBytes(options.dbSizeBytes)}</span>
								</div>
								<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
									<Timer className="size-3.5" />
									<span>Estimated backup time: {estimateBackupTime(options.dbSizeBytes)}</span>
								</div>
								<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
									<Zap className="size-3.5" />
									<span>Suggested compression: level {options.suggestedCompressLevel}</span>
								</div>
							</div>
							{options.dbSizeBytes > LARGE_DB_THRESHOLD_BYTES ? (
								<div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
									<TriangleAlert className="mt-0.5 size-4 shrink-0" />
									<div>
										<p className="font-medium">Large database detected ({formatBytes(options.dbSizeBytes)})</p>
										<p className="mt-0.5">
											This backup may take {estimateBackupTime(options.dbSizeBytes)}. Ensure you have sufficient disk space (at least 2x the database size). Consider using
											schema-only mode or excluding large tables.
										</p>
									</div>
								</div>
							) : null}
						</div>
					) : null}

					{options !== undefined ? (
						<div className="space-y-2">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<Label>Exclude table rows (schema is always kept)</Label>
									<p className="text-xs text-muted-foreground">
										Excluded tables still restore with their structure — only their rows are skipped. Useful for high-volume observability tables.
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-xs text-muted-foreground tabular-nums">
										{excluded.length} / {options.tables.length} excluded
									</span>
									<Button type="button" variant="outline" size="sm" disabled={formDisabled} onClick={onSelectAllTables} className="gap-1">
										<CheckSquare className="size-3.5" />
										Select all
									</Button>
									<Button type="button" variant="outline" size="sm" disabled={formDisabled || excluded.length === 0} onClick={onClearExcluded} className="gap-1">
										<SquareDashedMousePointer className="size-3.5" />
										Clear
									</Button>
									<Button type="button" variant="outline" size="sm" disabled={formDisabled || isDefaultSelection} onClick={onRestoreDefaults} className="gap-1">
										<Settings2 className="size-3.5" />
										Restore defaults
									</Button>
								</div>
							</div>
							{options.tables.length > 0 ? (
								<div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
									{options.tables.map((table) => (
										<BackupExcludeTableCheckbox
											key={table.name}
											table={table}
											isExcluded={excluded.includes(table.name)}
											disabled={formDisabled}
											onToggle={onExcludeTableToggle}
										/>
									))}
								</div>
							) : null}
						</div>
					) : null}

					<div className="flex flex-wrap items-center justify-end gap-2">
						{lastCompleted !== undefined && lastCompleted.sizeBytes !== null ? (
							<span className="mr-auto text-xs text-muted-foreground">
								Last backup: {formatBytes(lastCompleted.sizeBytes)} · {formatDateTime(lastCompleted.createdAt)} — expect a comparable dump size.
							</span>
						) : null}
						{activeBackup !== undefined ? (
							<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<Loader2 className="size-3 animate-spin" />
								Waiting for the running job…
							</span>
						) : null}
						<Button type="submit" disabled={formDisabled} className="gap-1.5">
							{createPending ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
							Start backup
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
