"use client";

import { Button } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronRight, X } from "lucide-react";
import * as React from "react";

import type { KanbanFeatureRollup } from "../lib/kanban-board-model";
import { formatDateRange, percentOf } from "../lib/kanban-display";
import { KanbanLevelChip } from "./kanban-task-badges";

interface RollupRowProps {
	readonly row: KanbanFeatureRollup;
	readonly isSelected: boolean;
	readonly onSelect: (featureId: string) => void;
}

/** One active feature: its key and title under its epic, its stories done of all as a bar, and its own dates. */
function RollupRow({ row, isSelected, onSelect }: RollupRowProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(row.feature.id);
	}, [onSelect, row.feature.id]);
	const percent = percentOf(row.done, row.total);
	const hasDates = row.feature.startAt !== null || row.feature.dueAt !== null;
	return (
		<li>
			<button
				type="button"
				aria-pressed={isSelected}
				onClick={handleClick}
				className={cn(
					"flex w-full min-w-0 flex-col gap-1.5 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
					isSelected ? "bg-primary text-primary-foreground" : "transition-colors hover:bg-foreground/10",
				)}>
				<span className="flex min-w-0 items-center gap-2">
					{isSelected ? (
						<span className="shrink-0 font-mono text-[0.6875rem] leading-4 opacity-80">{row.feature.key ?? "FEATURE"}</span>
					) : (
						<KanbanLevelChip type="FEATURE" itemKey={row.feature.key} showIcon={false} />
					)}
					<span className="min-w-0 truncate text-sm font-medium">{row.feature.title}</span>
				</span>
				{row.epic === null ? null : (
					<span className={cn("truncate text-xs", isSelected ? "opacity-80" : "text-muted-foreground")}>
						{row.epic.key === null ? row.epic.title : `${row.epic.key} · ${row.epic.title}`}
					</span>
				)}
				<span className="flex items-center gap-2">
					<Progress
						value={percent}
						className={cn("h-1 flex-1", isSelected && "[&_[data-slot=progress-indicator]]:bg-primary-foreground")}
						aria-label={`${row.feature.title}: ${String(row.done)} of ${String(row.total)} stories done`}
					/>
					<span className={cn("shrink-0 text-xs tabular-nums", isSelected ? "opacity-90" : "text-muted-foreground")}>
						{row.done}/{row.total}
					</span>
				</span>
				<span className={cn("text-xs tabular-nums", isSelected ? "opacity-80" : "text-muted-foreground")}>
					{hasDates ? formatDateRange(row.feature.startAt, row.feature.dueAt) : "—"}
				</span>
			</button>
		</li>
	);
}

export interface KanbanRollupStripProps {
	readonly rows: readonly KanbanFeatureRollup[];
	readonly isOpen: boolean;
	readonly onToggle: () => void;
	/** The feature the board is narrowed to, if any. */
	readonly selectedFeatureId: string | undefined;
	/** Narrows the board to a feature; the selected one again clears it. */
	readonly onSelectFeature: (featureId: string | undefined) => void;
}

/**
 * The execution board's rollup strip: the features with work still open, each
 * read at a glance — how many of its stories are done and when it is due — and
 * a way into it: picking a row narrows the board to that feature. Folds away to
 * one line; whether it is open lives in the URL.
 */
export function KanbanRollupStrip({ rows, isOpen, onToggle, selectedFeatureId, onSelectFeature }: KanbanRollupStripProps): React.JSX.Element | null {
	const handleSelect = React.useCallback(
		(featureId: string): void => {
			onSelectFeature(featureId === selectedFeatureId ? undefined : featureId);
		},
		[onSelectFeature, selectedFeatureId],
	);
	const clear = React.useCallback((): void => {
		onSelectFeature(undefined);
	}, [onSelectFeature]);
	if (rows.length === 0 && selectedFeatureId === undefined) {
		return null;
	}
	const listId = "kanban-rollup-strip";
	return (
		<section aria-label="Active features" className="border-b px-4 py-2 lg:px-5">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" className="-ml-2" aria-expanded={isOpen} aria-controls={listId} onClick={onToggle}>
					<ChevronRight data-icon="inline-start" className={cn("transition-transform duration-200", isOpen && "rotate-90")} />
					Active features
					<span className="text-muted-foreground tabular-nums">{rows.length}</span>
				</Button>
				{selectedFeatureId === undefined ? null : (
					<Button variant="ghost" size="sm" onClick={clear}>
						<X data-icon="inline-start" />
						Show every feature
					</Button>
				)}
			</div>
			{isOpen ? (
				<ul id={listId} className="grid max-h-56 gap-1 overflow-y-auto pt-1 pb-1 [scrollbar-width:thin] sm:grid-cols-2 xl:grid-cols-4">
					{rows.map((row) => (
						<RollupRow key={row.feature.id} row={row} isSelected={row.feature.id === selectedFeatureId} onSelect={handleSelect} />
					))}
				</ul>
			) : null}
		</section>
	);
}
