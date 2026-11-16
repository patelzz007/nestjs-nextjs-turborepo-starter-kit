"use client";

import { Button } from "@workspace/ui/components/button";
import { toastMessage } from "@workspace/ui/components/toast";
import { FileIcon } from "lucide-react";
import * as React from "react";

// A loading toast whose `data.progress` drives the bottom progress bar; it is
// updated on every tick and turns into a success toast when the upload ends.

const UPLOAD_TICK_MS = 500;
/** How far the simulated upload advances per tick (percent). */
const UPLOAD_STEP_PERCENT = 12;
const UPLOAD_COMPLETE_PERCENT = 100;
/** How long the finished toast stays before dismissing itself (ms). */
const COMPLETED_TIMEOUT_MS = 3000;
/** A `timeout` of 0 keeps the toast up while the upload runs. */
const WHILE_UPLOADING_TIMEOUT_MS = 0;

const FILE_NAME = "report-q4-2025.pdf";
const FILE_SIZE_LABEL = "2.4 MB";
const FILE_ICON = <FileIcon aria-hidden="true" />;

function uploadingDescription(percent: number): string {
	return `${FILE_SIZE_LABEL} · Uploading... ${String(percent)}%`;
}

export function Sonner10Example(): React.JSX.Element {
	const intervalRef = React.useRef<number | undefined>(undefined);

	const stopTicking = React.useCallback((): void => {
		window.clearInterval(intervalRef.current);
		intervalRef.current = undefined;
	}, []);

	// Stop the simulated upload if the example unmounts mid-way.
	React.useEffect((): (() => void) => stopTicking, [stopTicking]);

	const showUploadToast = React.useCallback((): void => {
		stopTicking();
		let progress = 0;
		const id = toastMessage.loading({
			title: FILE_NAME,
			description: uploadingDescription(progress),
			timeout: WHILE_UPLOADING_TIMEOUT_MS,
			data: { progress, icon: FILE_ICON },
		});

		intervalRef.current = window.setInterval((): void => {
			progress = Math.min(progress + UPLOAD_STEP_PERCENT, UPLOAD_COMPLETE_PERCENT);
			if (progress < UPLOAD_COMPLETE_PERCENT) {
				toastMessage.update(id, { description: uploadingDescription(progress), data: { progress, icon: FILE_ICON } });
				return;
			}
			stopTicking();
			toastMessage.update(id, { type: "success", description: `${FILE_SIZE_LABEL} · Complete`, timeout: COMPLETED_TIMEOUT_MS, data: { icon: FILE_ICON } });
		}, UPLOAD_TICK_MS);
	}, [stopTicking]);

	return (
		<div className="flex items-center justify-center">
			<Button onClick={showUploadToast} variant="outline" className="w-fit">
				Upload Toast
			</Button>
		</div>
	);
}
