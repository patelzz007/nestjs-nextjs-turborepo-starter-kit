import { Button } from "@workspace/ui-native/components/button";
import { Progress } from "@workspace/ui-native/components/progress";
import FileIcon from "lucide-react-native/icons/file";
import * as React from "react";

import { useToast } from "../../../toast/facade";

// A loading toast whose progress bar fills in place (`update` on the same id),
// then turns into a success toast that leaves on its own.
const TICK_MS = 500;
/** How far the simulated upload advances per tick, in percent. */
const STEP_PERCENT = 12;
const COMPLETE_PERCENT = 100;
/** How long the finished toast stays. */
const COMPLETED_MS = 3_000;
const FILE_NAME = "report-q4-2025.pdf";
const FILE_SIZE = "2.4 MB";

function uploading(percent: number): string {
	return `${FILE_SIZE} · Uploading… ${String(percent)}%`;
}

function bar(percent: number): React.JSX.Element {
	return <Progress value={percent} size="sm" accessibilityLabel={`Uploading ${FILE_NAME}`} />;
}

export function Sonner10Example(): React.JSX.Element {
	const toast = useToast();
	const ticker = React.useRef<ReturnType<typeof setInterval> | null>(null);
	const stop = React.useCallback((): void => {
		if (ticker.current !== null) {
			clearInterval(ticker.current);
			ticker.current = null;
		}
	}, []);
	// Stop the simulated upload if the example leaves the screen mid-way.
	React.useEffect((): (() => void) => stop, [stop]);
	const upload = React.useCallback((): void => {
		stop();
		let percent = 0;
		const id = toast.loading(uploading(percent), { title: FILE_NAME, icon: FileIcon, content: bar(percent) });
		ticker.current = setInterval((): void => {
			percent = Math.min(percent + STEP_PERCENT, COMPLETE_PERCENT);
			if (percent < COMPLETE_PERCENT) {
				toast.update(id, "loading", uploading(percent), { title: FILE_NAME, icon: FileIcon, content: bar(percent), durationMs: null });
				return;
			}
			stop();
			toast.update(id, "success", `${FILE_SIZE} · Complete`, { title: FILE_NAME, icon: FileIcon, durationMs: COMPLETED_MS });
		}, TICK_MS);
	}, [stop, toast]);
	return <Button label="Upload Toast" variant="outline" onPress={upload} className="self-center" />;
}
