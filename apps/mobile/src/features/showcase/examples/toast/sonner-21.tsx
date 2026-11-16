import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

// One toast rewritten in place through its id: a loading toast whose text
// advances through the upload's stages, then a success toast.
/** Time between the simulated upload's stages. */
const STAGE_INTERVAL_MS = 1_000;
/** How long the finished toast stays. */
const COMPLETED_MS = 4_000;
/** The loading lines shown after the first one, one per stage. */
const UPLOAD_STAGES: readonly string[] = ["Uploading files… 30%", "Uploading files… 70%"];

export function Sonner21Example(): React.JSX.Element {
	const toast = useToast();
	const timers = React.useRef<readonly ReturnType<typeof setTimeout>[]>([]);
	const clearStages = React.useCallback((): void => {
		for (const timer of timers.current) {
			clearTimeout(timer);
		}
		timers.current = [];
	}, []);
	// Stop the simulated upload if the example leaves the screen mid-way.
	React.useEffect((): (() => void) => clearStages, [clearStages]);
	const start = React.useCallback((): void => {
		clearStages();
		const id = toast.loading("Preparing upload…");
		const stages = UPLOAD_STAGES.map((line: string, stage: number): ReturnType<typeof setTimeout> =>
			setTimeout(
				(): void => {
					toast.update(id, "loading", line, { durationMs: null });
				},
				STAGE_INTERVAL_MS * (stage + 1),
			),
		);
		const done = setTimeout(
			(): void => {
				toast.update(id, "success", "3 files uploaded successfully.", { title: "Upload complete!", durationMs: COMPLETED_MS });
			},
			STAGE_INTERVAL_MS * (UPLOAD_STAGES.length + 1),
		);
		timers.current = [...stages, done];
	}, [clearStages, toast]);
	return <Button label="Updatable Toast" variant="outline" onPress={start} className="self-center" />;
}
