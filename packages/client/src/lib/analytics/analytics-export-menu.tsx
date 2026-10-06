"use client";

// ============================================
// lib/analytics/analytics-export-menu.tsx - "Export ▾ CSV / Excel / PDF" for the merchant and admin dashboards
// ============================================
// Smart component: downloads the report for the range on screen through
// `api.download` (session cookies + the silent-refresh pipeline, typed
// `ApiDownloadError`), saves it under the server's file name, and reports the
// outcome — a polite live-region status while it runs, a toast when it ends.
// One export at a time: the trigger is disabled while a download runs.

import { ANALYTICS_EXPORT_RATE_LIMIT, ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS, type AnalyticsExportFormat, type SerializableInput } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/core/utils";
import { Download } from "lucide-react";
import * as React from "react";

import { ApiDownloadError, saveDownloadedFile, type DownloadDef, type DownloadedFile } from "../api/download";
import { useAuth } from "../auth";

/** The formats, in menu order, with what the person reads. */
export const ANALYTICS_EXPORT_OPTIONS: readonly { readonly format: AnalyticsExportFormat; readonly label: string }[] = [
	{ format: "csv", label: "CSV" },
	{ format: "xlsx", label: "Excel (XLSX)" },
	{ format: "pdf", label: "PDF" },
];

const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = 60_000;

/** "45 seconds" / "1 minute" / "3 minutes" — how long to wait before the next export. */
export function formatRetryWait(seconds: number): string {
	if (seconds < SECONDS_PER_MINUTE) {
		return `${String(seconds)} ${seconds === 1 ? "second" : "seconds"}`;
	}
	const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
	return `${String(minutes)} ${minutes === 1 ? "minute" : "minutes"}`;
}

/** What the person is told after a failed export. `null` = they cancelled it; say nothing. */
export interface ExportFailureMessage {
	readonly title: string;
	readonly description: string;
}

/** Maps a failed download to an actionable message, by the API's stable error code. */
export function describeExportFailure(error: ApiDownloadError): ExportFailureMessage | null {
	switch (error.code) {
		case "ABORTED":
			return null;
		case "ANALYTICS_EXPORT_RATE_LIMITED": {
			const limit = `You can start ${String(ANALYTICS_EXPORT_RATE_LIMIT)} exports every ${String(ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS / MS_PER_MINUTE)} minutes.`;
			return {
				title: "Export limit reached",
				description: error.retryAfterSeconds === undefined ? `${limit} Try again shortly.` : `${limit} Try again in ${formatRetryWait(error.retryAfterSeconds)}.`,
			};
		}
		case "ANALYTICS_QUERY_TIMEOUT":
			return { title: "The report took too long", description: "Choose a shorter date range or group by week or month, then export again." };
		case "VALIDATION_ERROR":
			return { title: "Can't export this range", description: error.message };
		case "NETWORK_ERROR":
			return { title: "Export failed", description: "Check your connection and try again." };
		default:
			return {
				title: "Export failed",
				description: error.correlationId === undefined ? error.message : `${error.message} (reference ${error.correlationId})`,
			};
	}
}

type ExportStatus =
	{ readonly kind: "idle" } | { readonly kind: "running"; readonly label: string } | { readonly kind: "saved"; readonly fileName: string } | { readonly kind: "failed" };

const IDLE: ExportStatus = { kind: "idle" };

function statusText(status: ExportStatus): string {
	switch (status.kind) {
		case "idle":
			return "";
		case "running":
			return `Preparing the ${status.label} export…`;
		case "saved":
			return `Downloaded ${status.fileName}`;
		case "failed":
			return "The export failed";
	}
}

export interface AnalyticsExportMenuProps<TInput extends SerializableInput> {
	/** The file route (`apiDownloads.organizations.analyticsExport`, `apiDownloads.rewardsAdmin.analyticsExport`). */
	readonly definition: DownloadDef<TInput>;
	/** The request for one format — the range, interval (and store) on screen. */
	readonly inputFor: (format: AnalyticsExportFormat) => TInput;
	readonly disabled?: boolean;
	readonly className?: string;
	/** Hands the file to the browser; replaceable in tests. */
	readonly saveFile?: (file: DownloadedFile) => void;
}

/** Export the dashboard's range as CSV, Excel or PDF (merchant and admin dashboards only). */
export function AnalyticsExportMenu<TInput extends SerializableInput>({
	definition,
	inputFor,
	disabled = false,
	className,
	saveFile = saveDownloadedFile,
}: AnalyticsExportMenuProps<TInput>): React.JSX.Element {
	const { api } = useAuth();
	const [status, setStatus] = React.useState<ExportStatus>(IDLE);
	const isRunning = status.kind === "running";

	const runExport = React.useCallback(
		async (format: AnalyticsExportFormat, label: string): Promise<void> => {
			setStatus({ kind: "running", label });
			try {
				const file = await api.download(definition, inputFor(format));
				saveFile(file);
				setStatus({ kind: "saved", fileName: file.fileName });
				toastMessage.success({ title: "Export ready", description: `${file.fileName} has been downloaded.` });
			} catch (error: unknown) {
				const failure =
					error instanceof ApiDownloadError ? describeExportFailure(error) : { title: "Export failed", description: "The report could not be exported. Try again." };
				setStatus(failure === null ? IDLE : { kind: "failed" });
				if (failure !== null) {
					toastMessage.error(failure);
				}
			}
		},
		[api, definition, inputFor, saveFile],
	);

	const handleSelect = React.useCallback(
		(format: AnalyticsExportFormat, label: string): void => {
			void runExport(format, label);
		},
		[runExport],
	);

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" loading={isRunning} />} disabled={disabled || isRunning}>
					{isRunning ? null : <Download aria-hidden="true" />}
					Export
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					{ANALYTICS_EXPORT_OPTIONS.map((option) => (
						<ExportMenuItem key={option.format} format={option.format} label={option.label} onSelect={handleSelect} />
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<span role="status" aria-live="polite" className="sr-only">
				{statusText(status)}
			</span>
		</div>
	);
}

interface ExportMenuItemProps {
	readonly format: AnalyticsExportFormat;
	readonly label: string;
	readonly onSelect: (format: AnalyticsExportFormat, label: string) => void;
}

function ExportMenuItem({ format, label, onSelect }: ExportMenuItemProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(format, label);
	}, [format, label, onSelect]);
	return <DropdownMenuItem onClick={handleClick}>{label}</DropdownMenuItem>;
}
