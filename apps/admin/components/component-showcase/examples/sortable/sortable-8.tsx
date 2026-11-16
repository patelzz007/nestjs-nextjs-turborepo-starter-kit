"use client";

import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Sortable, SortableItem, SortableItemHandle, type SortableCommitMeta } from "@workspace/ui/components/sortable";
import { toastMessage } from "@workspace/ui/components/toast";

interface Item {
	id: string;
	title: string;
}

const defaultItems: Item[] = [
	{ id: "1", title: "Draft the release notes" },
	{ id: "2", title: "Review open pull requests" },
	{ id: "3", title: "Update the changelog" },
	{ id: "4", title: "Cut the release tag" },
	{ id: "5", title: "Announce on the blog" },
];

/** How long the simulated save takes, in milliseconds. */
const SIMULATED_SAVE_DELAY_MS = 700;
/** Share of simulated saves that fail, so the optimistic rollback is easy to see. */
const SIMULATED_FAILURE_RATE = 0.25;

// Simulated backend. Swap for a real mutation in your app. Rejects roughly one
// in four calls so the optimistic rollback is easy to see.
function persistOrder(): Promise<void> {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			if (Math.random() < SIMULATED_FAILURE_RATE) {
				reject(new Error("Network error"));
			} else {
				resolve();
			}
		}, SIMULATED_SAVE_DELAY_MS);
	});
}

/**
 * The toast promise re-rejects after its `error` handler ran. That handler
 * already told the user and rolled the order back, so the rejection is settled here.
 */
function settleReportedSaveFailure(): void {
	return;
}

function getItemValue(item: Item): string {
	return item.id;
}

export function Sortable8Example(): React.JSX.Element {
	const [items, setItems] = useState<Item[]>(defaultItems);

	// Sortable commits once, on drop. `onValueChange` has already applied the
	// new order optimistically; meta.previousValue is the order before the drag.
	const handleValueCommit = React.useCallback((next: Item[], meta: SortableCommitMeta<Item>): void => {
		const previous = meta.previousValue;
		const moved = next.at(meta.overIndex);
		const position = String(meta.overIndex + 1);
		const savedMessage = moved === undefined ? `Saved position ${position}` : `Saved "${moved.title}" at position ${position}`;

		toastMessage
			.promise(persistOrder(), {
				loading: "Saving order...",
				success: savedMessage,
				error: (): string => {
					// Roll back to the pre-drag order. In production prefer a refetch here
					// so a newer drag is not clobbered by this snapshot.
					setItems(previous);
					return "Could not save the new order. Restored.";
				},
			})
			.catch(settleReportedSaveFailure);
	}, []);

	return (
		<div className="mx-auto w-full max-w-xl p-6">
			<Sortable value={items} onValueChange={setItems} onValueCommit={handleValueCommit} getItemValue={getItemValue} strategy="vertical" className="space-y-2">
				{items.map((item, index) => (
					<SortableItem key={item.id} value={item.id}>
						<div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
							<SortableItemHandle className="text-muted-foreground hover:text-foreground">
								<GripVerticalIcon className="h-4 w-4" />
							</SortableItemHandle>
							<Badge variant="outline" className="tabular-nums">
								{index + 1}
							</Badge>
							<span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
						</div>
					</SortableItem>
				))}
			</Sortable>
		</div>
	);
}
