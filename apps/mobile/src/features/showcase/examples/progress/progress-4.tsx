import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";
import { Text, View } from "react-native";

/** One stage of the simulated download: shown while progress is below `below` percent. */
interface DownloadStage {
	readonly below: number;
	readonly message: string;
}

const DOWNLOAD_STAGES: readonly DownloadStage[] = [
	{ below: 5, message: "Initializing download…" },
	{ below: 15, message: "Setting up environment…" },
	{ below: 25, message: "Connecting to server…" },
	{ below: 35, message: "Verifying permissions…" },
	{ below: 50, message: "Downloading core files…" },
	{ below: 65, message: "Downloading assets…" },
	{ below: 80, message: "Downloading dependencies…" },
	{ below: 90, message: "Extracting files…" },
	{ below: 95, message: "Validating integrity…" },
	{ below: 100, message: "Finalizing installation…" },
];
const COMPLETE_MESSAGE = "Download complete!";
const COMPLETE_PERCENT = 100;
/** Each tick advances by a random step between these bounds, in percent. */
const MIN_STEP_PERCENT = 1;
const STEP_SPREAD_PERCENT = 3;
const TICK_MS = 150;

function statusMessageFor(progress: number): string {
	return DOWNLOAD_STAGES.find((stage: DownloadStage): boolean => progress < stage.below)?.message ?? COMPLETE_MESSAGE;
}

/** The next simulated value; loops back to 0 once the download completes. */
function nextProgress(previous: number): number {
	if (previous >= COMPLETE_PERCENT) {
		return 0;
	}
	return Math.min(COMPLETE_PERCENT, previous + Math.random() * STEP_SPREAD_PERCENT + MIN_STEP_PERCENT);
}

export function Progress4Example(): React.JSX.Element {
	const [progress, setProgress] = React.useState(0);
	React.useEffect((): (() => void) => {
		const timer = setInterval((): void => {
			setProgress(nextProgress);
		}, TICK_MS);
		return (): void => {
			clearInterval(timer);
		};
	}, []);
	return (
		<View className="gap-2">
			<Progress value={progress} label="Downloading" showValue accessibilityLabel="Downloading" />
			<Text className="text-caption font-sans text-muted-foreground">{statusMessageFor(progress)}</Text>
		</View>
	);
}
