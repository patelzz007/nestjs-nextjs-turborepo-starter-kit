"use client";

import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";
import * as React from "react";

/** One stage of the simulated download: shown while progress is below `below` percent. */
interface DownloadStage {
	readonly below: number;
	readonly message: string;
}

const DOWNLOAD_STAGES: readonly DownloadStage[] = [
	{ below: 5, message: "Initializing download..." },
	{ below: 15, message: "Setting up environment..." },
	{ below: 25, message: "Connecting to server..." },
	{ below: 35, message: "Verifying permissions..." },
	{ below: 50, message: "Downloading core files..." },
	{ below: 65, message: "Downloading assets..." },
	{ below: 80, message: "Downloading dependencies..." },
	{ below: 90, message: "Extracting files..." },
	{ below: 95, message: "Validating integrity..." },
	{ below: 100, message: "Finalizing installation..." },
];

const COMPLETE_MESSAGE = "Download complete!";
const COMPLETE_PERCENT = 100;
/** Each tick advances by a random step between these bounds (percent). */
const MIN_STEP_PERCENT = 1;
const STEP_SPREAD_PERCENT = 3;
const TICK_INTERVAL_MS = 150;

function statusMessageFor(progress: number): string {
	return DOWNLOAD_STAGES.find((stage: DownloadStage): boolean => progress < stage.below)?.message ?? COMPLETE_MESSAGE;
}

/** The next simulated progress value; loops back to 0 once the download completes. */
function nextProgress(previous: number): number {
	if (previous >= COMPLETE_PERCENT) {
		return 0;
	}
	return Math.min(COMPLETE_PERCENT, previous + Math.random() * STEP_SPREAD_PERCENT + MIN_STEP_PERCENT);
}

export function Progress4Example(): React.JSX.Element {
	const [downloadProgress, setDownloadProgress] = React.useState(0);

	React.useEffect((): (() => void) => {
		const downloadTimer = setInterval((): void => {
			setDownloadProgress(nextProgress);
		}, TICK_INTERVAL_MS);

		return (): void => {
			clearInterval(downloadTimer);
		};
	}, []);

	return (
		<div className="w-full max-w-xs space-y-2">
			<Progress value={downloadProgress}>
				<ProgressLabel>Workspace Setup</ProgressLabel>
				<ProgressValue />
			</Progress>
			<div className="text-xs text-muted-foreground">{statusMessageFor(downloadProgress)}</div>
		</div>
	);
}
