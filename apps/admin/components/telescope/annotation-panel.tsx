"use client";

// ============================================
// components/telescope/annotation-panel.tsx
// Feature 14 — star/comment a request to mark it "investigating" for the team.
// Star toggles instantly; the comment saves via the parent's mutation callback.
//
// Dumb component: annotation + callbacks arrive via props.
// ============================================

import { Star } from "lucide-react";
import { useCallback, useState } from "react";

import type { TelescopeAnnotation } from "@workspace/shared";

import { formatDateTime } from "@/lib/dates";

export interface AnnotationPanelProps {
	readonly annotation: TelescopeAnnotation | null;
	readonly onToggleStar: (starred: boolean) => void;
	readonly onSaveComment: (comment: string) => void;
	readonly saving: boolean;
}

export function AnnotationPanel({ annotation, onToggleStar, onSaveComment, saving }: AnnotationPanelProps): React.JSX.Element {
	const [draft, setDraft] = useState<string>(annotation?.comment ?? "");
	// Keep the draft in sync with a *new* annotation payload (async first load
	// or a save that came back from the server) without clobbering the user's
	// in-progress typing. `updatedAt` only moves when the annotation changes,
	// so this re-syncs exactly then. Setting state during render is the
	// officially recommended "adjust state when a prop changes" pattern.
	const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(annotation?.updatedAt ?? null);
	const currentUpdatedAt: number | null = annotation?.updatedAt ?? null;
	if (lastSyncedAt !== currentUpdatedAt) {
		setLastSyncedAt(currentUpdatedAt);
		setDraft(annotation?.comment ?? "");
	}
	const starred: boolean = annotation?.starred === true;

	const handleStar = useCallback((): void => {
		onToggleStar(!starred);
	}, [onToggleStar, starred]);

	const handleSave = useCallback((): void => {
		onSaveComment(draft);
	}, [onSaveComment, draft]);

	return (
		<div className="flex items-start gap-3">
			<button
				type="button"
				onClick={handleStar}
				className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
					starred ? "border-amber-300/60 bg-amber-500/10 text-amber-600 dark:border-amber-500/40 dark:text-amber-400" : "text-muted-foreground hover:text-amber-500"
				}`}
				title={starred ? "Unstar this request" : "Star this request"}>
				<Star className={`size-3.5 ${starred ? "fill-amber-500 text-amber-500" : ""}`} />
				{starred ? "Starred" : "Star"}
			</button>

			<div className="min-w-0 flex-1">
				<textarea
					value={draft}
					onChange={(event: React.ChangeEvent<HTMLTextAreaElement>): void => {
						setDraft(event.target.value);
					}}
					placeholder="Note for the team (e.g. “investigating — N+1 in profile load”)…"
					rows={2}
					className="w-full resize-y rounded-md border bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
				/>
				<div className="mt-1.5 flex items-center justify-between">
					<span className="text-[11px] text-muted-foreground">{annotation !== null ? `Updated ${formatDateTime(annotation.updatedAt)}` : "No annotation yet"}</span>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving}
						className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
						{saving ? "Saving…" : "Save note"}
					</button>
				</div>
			</div>
		</div>
	);
}
