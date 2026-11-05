"use client";

// "Download my data" (ADR 077): one ZIP of everything the platform holds about the signed-in person, once a
// day. Smart component: fetches through `api.download` (cookies, silent refresh, typed `ApiDownloadError`),
// saves under the server's file name, and says how it went: a polite live status while it runs, a toast at
// the end, and when the daily export is used, how long until the next.

import { Button } from "@workspace/ui/components/button";
import { toastMessage } from "@workspace/ui/components/toast";
import { DownloadIcon } from "lucide-react";
import * as React from "react";

import { ApiDownloadError, apiDownloads, saveDownloadedFile, type DownloadedFile } from "../../api/download";
import { useAuth } from "../identity";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;

/** "40 minutes" / "1 hour" / "23 hours": how long until the next export. */
export function formatExportWait(seconds: number): string {
	if (seconds < SECONDS_PER_HOUR) {
		const minutes = Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE));
		return `${String(minutes)} ${minutes === 1 ? "minute" : "minutes"}`;
	}
	const hours = Math.ceil(seconds / SECONDS_PER_HOUR);
	return `${String(hours)} ${hours === 1 ? "hour" : "hours"}`;
}

/** What the person is told after a failed export. `null` = they cancelled it; say nothing. */
export function describeDataExportFailure(error: ApiDownloadError): { readonly title: string; readonly description: string } | null {
	switch (error.code) {
		case "ABORTED":
			return null;
		case "RATE_LIMITED":
			return {
				title: "You've already downloaded your data today",
				description:
					error.retryAfterSeconds === undefined
						? "You can download it once a day. Try again tomorrow."
						: `You can download it once a day. Try again in ${formatExportWait(error.retryAfterSeconds)}.`,
			};
		case "RESTRICTED_SESSION":
			return {
				title: "Finish securing your account first",
				description: "Verify your email address (and set up two-factor authentication if asked), then download your data.",
			};
		case "NETWORK_ERROR":
			return { title: "Download failed", description: "Check your connection and try again." };
		default:
			return { title: "Download failed", description: error.correlationId === undefined ? error.message : `${error.message} (reference ${error.correlationId})` };
	}
}

export interface DownloadMyDataPanelProps {
	/** Saves the downloaded file (tests pass a recorder). */
	readonly saveFile?: (file: DownloadedFile) => void;
}

/** The "Your data" section's action. */
export function DownloadMyDataPanel({ saveFile = saveDownloadedFile }: DownloadMyDataPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const [status, setStatus] = React.useState<"idle" | "running" | "done">("idle");
	const [fileName, setFileName] = React.useState<string | null>(null);

	const handleDownload = React.useCallback(async (): Promise<void> => {
		setStatus("running");
		try {
			const file = await api.download(apiDownloads.privacy.dataExport, {});
			saveFile(file);
			setFileName(file.fileName);
			setStatus("done");
			toastMessage.success({ title: "Your data is downloaded", description: `${file.fileName}: open the ZIP to see each part as a JSON file.` });
		} catch (error) {
			setStatus("idle");
			const failure =
				error instanceof ApiDownloadError ? describeDataExportFailure(error) : { title: "Download failed", description: "Your data could not be downloaded. Try again." };
			if (failure !== null) {
				toastMessage.error(failure);
			}
		}
	}, [api, saveFile]);
	const onClick = React.useCallback((): void => {
		void handleDownload();
	}, [handleDownload]);

	return (
		<div className="flex flex-col gap-3">
			<p className="text-sm text-muted-foreground">
				A ZIP with your profile, settings, signed-in devices, notifications, claims and referrals, one JSON file each. Passwords, security codes and device tokens are never
				included. Once a day.
			</p>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="button" variant="outline" onClick={onClick} disabled={status === "running"}>
					<DownloadIcon aria-hidden="true" />
					{status === "running" ? "Preparing your data…" : "Download my data"}
				</Button>
				<span role="status" aria-live="polite" className="text-sm text-muted-foreground">
					{status === "running" ? "Preparing your data…" : status === "done" && fileName !== null ? `Downloaded ${fileName}` : ""}
				</span>
			</div>
		</div>
	);
}
