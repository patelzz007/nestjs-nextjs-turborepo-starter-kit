"use client";

import { Button } from "@workspace/ui/components/form/button";
import { Toaster, toastMessage, type ToastPosition } from "@workspace/ui/components/feedback/toast";
import * as React from "react";
import { memo, useCallback, useState } from "react";

// ── Smart component: data + behaviour live here (rules 9/10) ────────────────

const TOAST_POSITION_OPTIONS: readonly { readonly value: ToastPosition; readonly label: string }[] = [
	{ value: "bottom-right", label: "Bottom right" },
	{ value: "bottom-left", label: "Bottom left" },
	{ value: "bottom-center", label: "Bottom center" },
	{ value: "top-right", label: "Top right" },
	{ value: "top-left", label: "Top left" },
	{ value: "top-center", label: "Top center" },
];

interface ToastPositionButtonProps {
	readonly value: ToastPosition;
	readonly label: string;
	readonly active: boolean;
	readonly onSelect: (position: ToastPosition) => void;
}

/** Compact position-picker button — memoized so only the toggled one re-renders. */
const ToastPositionButton = memo(function ToastPositionButton({ value, label, active, onSelect }: ToastPositionButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onSelect(value);
	}, [onSelect, value]);

	return (
		<Button size="sm" variant={active ? "default" : "outline"} aria-pressed={active} onClick={handleClick}>
			{label}
		</Button>
	);
});

export function ToastShowcase(): React.JSX.Element {
	const [position, setPosition] = useState<ToastPosition>("bottom-right");

	const handlePositionChange = useCallback((next: ToastPosition): void => {
		setPosition(next);
	}, []);

	const handleSuccess = useCallback((): void => {
		toastMessage.success({
			title: "Deploy complete",
			description: "v2.14.0 is live on production.",
			timeout: 4000,
		});
	}, []);

	const handleError = useCallback((): void => {
		toastMessage.error({
			title: "Refresh failed",
			description: "The proxy could not reach the auth service.",
		});
	}, []);

	const handleWarning = useCallback((): void => {
		toastMessage.warning({
			title: "Storage at 82%",
			description: "Purge stale exports or bump the plan.",
			timeout: 6000,
		});
	}, []);

	const handleInfo = useCallback((): void => {
		toastMessage.info({
			title: "Maintenance window",
			description: "Scheduled maintenance starts at 02:00 UTC.",
		});
	}, []);

	const handleLoading = useCallback((): void => {
		const id = toastMessage.loading({
			title: "Uploading…",
			description: "media/live-demo.mp4 is uploading",
			timeout: 0,
		});
		// Simulate a 2.5s upload, then flip the toast to success (feature 8 update).
		window.setTimeout(() => {
			toastMessage.update(id, {
				title: "Upload complete",
				description: "media/live-demo.mp4 · 48 MB",
				type: "success",
				timeout: 4000,
			});
		}, 2500);
	}, []);

	const handleProgress = useCallback((): void => {
		// A progress toast: start at 0%, tick up to 100%, then flip to success.
		const id = toastMessage.loading({
			title: "Backup in progress",
			description: "Verifying 1,248 rows…",
			timeout: 0,
			data: { progress: 0 },
		});
		let step = 0;
		const interval = window.setInterval(() => {
			step += 10;
			toastMessage.update(id, {
				description: `Verifying 1,248 rows… ${String(step)}%`,
				data: { progress: step },
			});
			if (step >= 100) {
				window.clearInterval(interval);
				toastMessage.update(id, {
					title: "Backup verified",
					description: "1,248 rows checked — all good.",
					type: "success",
					timeout: 4000,
					data: undefined,
				});
			}
		}, 250);
	}, []);

	const handleAction = useCallback((): void => {
		toastMessage.warning({
			title: "Action required",
			description: "A new role was requested for your review.",
			timeout: 8000,
			actionProps: {
				children: "Review",
				onClick: () => {
					toastMessage.success({ title: "Review opened", description: "Redirecting to the role request…" });
				},
			},
		});
	}, []);

	const handlePromise = useCallback((): void => {
		const job = new Promise<void>((resolve) => {
			window.setTimeout(resolve, 2000);
		});
		void toastMessage.promise(job, {
			loading: "Saving dashboard layout…",
			success: "Layout saved",
			error: "Could not save layout",
		});
	}, []);

	const handleDismissAll = useCallback((): void => {
		toastMessage.dismiss();
	}, []);

	return (
		<section aria-labelledby="toast-gallery-title" className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs sm:p-6">
			<h2 id="toast-gallery-title" className="text-sm font-medium">
				Toast &amp; Toastr
			</h2>
			<p className="mt-1 text-xs text-muted-foreground">
				Imperative toasts with typed helpers: success/error/warning/info/loading, progress bars, action buttons, promise auto-resolution and update-in-place.
			</p>

			<div className="mt-4 flex flex-wrap gap-3">
				<Button variant="default" onClick={handleSuccess}>
					Success
				</Button>
				<Button variant="destructive" onClick={handleError}>
					Error
				</Button>
				<Button variant="secondary" onClick={handleWarning}>
					Warning
				</Button>
				<Button variant="outline" onClick={handleInfo}>
					Info
				</Button>
				<Button variant="outline" onClick={handleLoading}>
					Loading → update
				</Button>
				<Button variant="outline" onClick={handleProgress}>
					Progress bar
				</Button>
				<Button variant="outline" onClick={handleAction}>
					With action
				</Button>
				<Button variant="outline" onClick={handlePromise}>
					Promise
				</Button>
				<Button variant="ghost" onClick={handleDismissAll}>
					Dismiss all
				</Button>
			</div>

			{/* Live position picker — repositions the whole stack instantly (feature 11). */}
			<div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
				<span className="text-xs font-medium text-muted-foreground">Position</span>
				{TOAST_POSITION_OPTIONS.map((option) => (
					<ToastPositionButton key={option.value} value={option.value} label={option.label} active={position === option.value} onSelect={handlePositionChange} />
				))}
			</div>

			{/* The Toaster mounts the viewport + list for the default manager. */}
			<Toaster position={position} />
		</section>
	);
}
