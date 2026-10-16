"use client";

import { Button } from "@workspace/ui/components/button";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

// One toast updated in place: a loading toast whose text advances through the
// upload's stages, then turns into a success toast.

/** Time between the simulated upload's stages (ms). */
const STAGE_INTERVAL_MS = 1000;
/** How long the finished toast stays before dismissing itself (ms). */
const COMPLETED_TIMEOUT_MS = 4000;
/** A `timeout` of 0 keeps the toast up while the upload runs. */
const WHILE_UPLOADING_TIMEOUT_MS = 0;

/** The loading titles shown after the first one, one per stage. */
const UPLOAD_STAGES: readonly string[] = ["Uploading files... 30%", "Uploading files... 70%"];

export function Sonner21Example(): React.JSX.Element {
	const timeoutsRef = React.useRef<readonly number[]>([]);

	const clearStages = React.useCallback((): void => {
		for (const timeoutId of timeoutsRef.current) {
			window.clearTimeout(timeoutId);
		}
		timeoutsRef.current = [];
	}, []);

	// Stop the simulated upload if the example unmounts mid-way.
	React.useEffect((): (() => void) => clearStages, [clearStages]);

	const startUpload = React.useCallback((): void => {
		clearStages();
		const id = toastMessage.loading({ title: "Preparing upload...", timeout: WHILE_UPLOADING_TIMEOUT_MS });

		const stageTimeouts = UPLOAD_STAGES.map((title: string, stage: number): number =>
			window.setTimeout(
				(): void => {
					toastMessage.update(id, { title });
				},
				STAGE_INTERVAL_MS * (stage + 1),
			),
		);
		const doneTimeout = window.setTimeout(
			(): void => {
				toastMessage.update(id, { type: "success", title: "Upload complete!", description: "3 files uploaded successfully.", timeout: COMPLETED_TIMEOUT_MS });
			},
			STAGE_INTERVAL_MS * (UPLOAD_STAGES.length + 1),
		);
		timeoutsRef.current = [...stageTimeouts, doneTimeout];
	}, [clearStages]);

	return (
		<div className="flex items-center justify-center">
			<Button onClick={startUpload} variant="outline" className="w-fit">
				Updatable Toast
			</Button>
		</div>
	);
}
