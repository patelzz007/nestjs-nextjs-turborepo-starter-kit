import { Badge } from "@workspace/ui-native/components/badge";
import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle, type SortableMove } from "@workspace/ui-native/components/sortable";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

import { useToast } from "../../../toast/facade";

interface Task {
	readonly id: string;
	readonly title: string;
}

const TASKS: readonly Task[] = [
	{ id: "1", title: "Draft the release notes" },
	{ id: "2", title: "Review open pull requests" },
	{ id: "3", title: "Update the changelog" },
	{ id: "4", title: "Cut the release tag" },
	{ id: "5", title: "Announce on the blog" },
];

/** How long the pretend save takes, and how often it fails (so the rollback shows). */
const SIMULATED_SAVE_DELAY_MS = 700;
const SIMULATED_FAILURE_RATE = 0.25;

/** A stand-in for saving the order: resolves after a delay, sometimes rejects. No network involved. */
function saveOrder(): Promise<void> {
	return new Promise((resolve: () => void, reject: (reason: Error) => void): void => {
		setTimeout((): void => {
			if (Math.random() < SIMULATED_FAILURE_RATE) {
				reject(new Error("save failed"));
				return;
			}
			resolve();
		}, SIMULATED_SAVE_DELAY_MS);
	});
}

function getItemValue(task: Task): string {
	return task.id;
}

// The new order shows at once and is saved behind it; a failed save puts the previous order back.
export function Sortable8Example(): React.JSX.Element {
	const toast = useToast();
	const [items, setItems] = React.useState<readonly Task[]>(TASKS);
	const commit = React.useCallback(
		(next: readonly Task[], move: SortableMove): void => {
			const previous = items;
			const moved = next.at(move.overIndex);
			const position = String(move.overIndex + 1);
			toast
				.promise(saveOrder(), {
					loading: "Saving the new order…",
					success: (): string => (moved === undefined ? `Saved position ${position}` : `Saved "${moved.title}" at position ${position}`),
					error: "Could not save the new order. Restored.",
				})
				.catch((): void => {
					setItems(previous);
				});
		},
		[items, toast],
	);
	return (
		<Sortable value={items} onValueChange={setItems} onValueCommit={commit} getItemValue={getItemValue} className="gap-2">
			{items.map((task: Task, position: number): React.JSX.Element => (
				<SortableItem key={task.id} value={task.id} label={task.title}>
					<View className="flex-row items-center gap-2 rounded-md border border-border bg-background px-1">
						<SortableItemHandle>
							<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
						</SortableItemHandle>
						<Badge label={String(position + 1)} variant="outline" size="sm" />
						<Text className="text-label flex-1 font-sans text-foreground">{task.title}</Text>
					</View>
				</SortableItem>
			))}
		</Sortable>
	);
}
