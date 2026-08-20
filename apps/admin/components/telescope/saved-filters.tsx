"use client";

// ============================================
// components/telescope/saved-filters.tsx
// Feature 9 — bookmark a request-list filter for one-click recall. Chips are
// rendered from localStorage (lib/saved-filters.ts); clicking one applies the
// filter, the ✕ deletes it, and "Save" bookmarks the current filter state.
//
// Dumb component: the current filter value + callbacks arrive via props.
// ============================================

import { Bookmark, BookmarkCheck, X } from "lucide-react";
import { useCallback, useState } from "react";

import { toastMessage } from "@workspace/ui/components/feedback/toast";

import type { SavedFilter, SavedFilterValue } from "@/lib/saved-filters";

export interface SavedFiltersProps {
	readonly saved: readonly SavedFilter[];
	readonly current: SavedFilterValue;
	readonly onApply: (filter: SavedFilterValue) => void;
	readonly onSave: (name: string, filter: SavedFilterValue) => void;
	readonly onDelete: (id: string) => void;
}

export function SavedFilters({ saved, current, onApply, onSave, onDelete }: SavedFiltersProps): React.JSX.Element {
	const [draftName, setDraftName] = useState<string>("");

	const handleSave = useCallback((): void => {
		const name: string = draftName.trim();
		if (name.length === 0) {
			toastMessage.warning({ title: "Give the filter a name first." });
			return;
		}
		onSave(name, current);
		setDraftName("");
	}, [draftName, current, onSave]);

	const handleDraftChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setDraftName(event.target.value);
	}, []);

	return (
		<div className="flex flex-wrap items-center gap-2">
			{saved.map((filter) => (
				<SavedFilterChip key={filter.id} filter={filter} onApply={onApply} onDelete={onDelete} />
			))}

			<input
				value={draftName}
				onChange={handleDraftChange}
				placeholder="Filter name…"
				className="h-7 w-36 rounded-full border bg-card px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
			/>
			<button
				type="button"
				onClick={handleSave}
				className="inline-flex h-7 items-center gap-1 rounded-full border bg-card px-2.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-primary">
				<Bookmark className="size-3" />
				Save filter
			</button>
		</div>
	);
}

/** Child component so onClick can live in a useCallback (eslint react/jsx-no-bind). */
function SavedFilterChip({
	filter,
	onApply,
	onDelete,
}: {
	readonly filter: SavedFilter;
	readonly onApply: (filter: SavedFilterValue) => void;
	readonly onDelete: (id: string) => void;
}): React.JSX.Element {
	const handleApply = useCallback((): void => {
		onApply(filter.filter);
	}, [onApply, filter.filter]);

	const handleDelete = useCallback((): void => {
		onDelete(filter.id);
	}, [onDelete, filter.id]);

	return (
		<span className="group inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-foreground shadow-xs transition-colors hover:border-primary/40">
			<button type="button" onClick={handleApply} className="inline-flex items-center gap-1.5 font-medium hover:underline">
				<BookmarkCheck className="size-3 text-primary" />
				{filter.name}
			</button>
			<button
				type="button"
				onClick={handleDelete}
				className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
				aria-label={`Delete saved filter ${filter.name}`}>
				<X className="size-3" />
			</button>
		</span>
	);
}
