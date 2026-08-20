"use client";

// ============================================
// components/telescope/replay-dialog.tsx
// Feature 7 — re-send a captured request against a configured target, WITH a
// confirmation dialog (a replay can hit live endpoints). The parent owns the
// replay mutation + the target list; this component is the dumb confirm UI.
// ============================================

import { AlertTriangle, Loader2, Play, RotateCw, X } from "lucide-react";
import { useCallback, useState } from "react";

import type { TelescopeReplayResponse } from "@workspace/shared";

export interface ReplayTargetOption {
	readonly name: string;
	readonly url: string;
}

export interface ReplayDialogProps {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly targets: readonly ReplayTargetOption[];
	readonly replaying: boolean;
	readonly result: TelescopeReplayResponse | null;
	readonly onReplay: (target: string) => void;
}

export function ReplayDialog({ open, onClose, targets, replaying, result, onReplay }: ReplayDialogProps): React.JSX.Element | null {
	const [target, setTarget] = useState<string>("local");

	const handleReplay = useCallback((): void => {
		onReplay(target);
	}, [onReplay, target]);

	const handleTargetChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
		setTarget(event.target.value);
	}, []);

	if (!open) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
			<div className="w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground shadow-xl">
				<div className="flex items-start justify-between">
					<div>
						<h3 className="flex items-center gap-2 text-sm font-semibold">
							<Play className="size-4 text-primary" />
							Replay request
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">Re-send the captured request to a configured environment. Credentials are never forwarded.</p>
					</div>
					<button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close replay dialog">
						<X className="size-4" />
					</button>
				</div>
				<div className="mt-4 flex items-center gap-2 rounded-md border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/40 dark:text-amber-400">
					<AlertTriangle className="size-3.5 shrink-0" />
					<span>This sends a real HTTP request. Only use against environments you control.</span>
				</div>
				<label htmlFor="replay-target" className="mt-4 block text-xs font-medium text-muted-foreground">
					Target
				</label>{" "}
				<select
					id="replay-target"
					value={target}
					onChange={handleTargetChange}
					className="mt-1.5 h-9 w-full rounded-md border bg-card px-2.5 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none">
					{targets.map((option) => (
						<option key={option.name} value={option.name}>
							{option.name} — {option.url}
						</option>
					))}
				</select>
				<div className="mt-4 flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
						Cancel
					</button>
					<button
						type="button"
						onClick={handleReplay}
						disabled={replaying}
						className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
						{replaying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
						{replaying ? "Replaying…" : "Replay"}
					</button>
				</div>
				{result !== null ? (
					<div className="mt-4 rounded-md border bg-muted/30 p-3">
						<div className="flex items-center gap-2 text-xs">
							<span
								className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono tabular-nums ${
									result.ok
										? "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400"
										: "border-red-300/60 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400"
								}`}>
								{result.status !== null ? String(result.status) : "ERR"}
							</span>
							<span className="font-mono text-muted-foreground">{String(result.durationMs)}ms</span>
						</div>
						{result.responsePreview !== null && result.responsePreview.length > 0 ? (
							<pre className="mt-2 max-h-32 overflow-auto rounded bg-background p-2 font-mono text-[11px] break-all whitespace-pre-wrap text-foreground">
								{result.responsePreview}
							</pre>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
