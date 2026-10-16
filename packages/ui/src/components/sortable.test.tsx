// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import {
	createDragAndDropAccessibility,
	findDuplicateId,
	reorderSortableValue,
	Sortable,
	SortableItem,
	SortableItemHandle,
	type SortableCommitMeta,
	type SortableRootProps,
} from "./sortable";

interface Task {
	readonly id: string;
	readonly title: string;
}

const TASKS: Task[] = [
	{ id: "a", title: "Alpha" },
	{ id: "b", title: "Bravo" },
	{ id: "c", title: "Charlie" },
];
const LABELS = UI_KIT_LABELS_EN.sortable;
/** The height (px) each stubbed item rect takes, stacked top to bottom. */
const ROW_HEIGHT = 40;
const ROW_WIDTH = 200;

function getTaskId(task: Task): string {
	return task.id;
}

function noop(): void {
	// a handler the test does not observe
}

function ids(tasks: readonly Task[]): string[] {
	return tasks.map(getTaskId);
}

function renderSortable(overrides: Partial<SortableRootProps<Task>> = {}): void {
	render(
		<Sortable<Task> value={TASKS} onValueChange={noop} getItemValue={getTaskId} {...overrides}>
			{TASKS.map((task): React.JSX.Element => (
				<SortableItem key={task.id} value={task.id} disabled={task.id === "c"}>
					<SortableItemHandle aria-label={`Drag ${task.title}`}>{task.title}</SortableItemHandle>
				</SortableItem>
			))}
		</Sortable>,
		{ wrapper: UiKitTestProviders },
	);
}

/** jsdom has no layout: give each item (by its `data-value`) a stacked rect, so the keyboard sensor has somewhere to move. */
function stubItemLayout(): void {
	const order = ids(TASKS);
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function stubRect(this: HTMLElement): DOMRect {
		const item = this.closest<HTMLElement>("[data-slot=sortable-item]");
		const index = item === null ? 0 : order.indexOf(item.dataset.value ?? "");
		return new DOMRect(0, Math.max(index, 0) * ROW_HEIGHT, ROW_WIDTH, ROW_HEIGHT);
	});
}

/** The keyboard sensor attaches its key listeners on the next task. */
async function flushTasks(): Promise<void> {
	await act(async (): Promise<void> => {
		await new Promise<void>((resolve): void => {
			setTimeout(resolve, 0);
		});
	});
}

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

describe("reorderSortableValue", () => {
	it("moves the active item to the target's index", (): void => {
		const result = reorderSortableValue(TASKS, getTaskId, "a", "c");
		expect(result === null ? null : ids(result.value)).toEqual(["b", "c", "a"]);
		expect(result?.activeIndex).toBe(0);
		expect(result?.overIndex).toBe(2);
	});

	it("returns null when dropped on itself or on an unknown id", (): void => {
		expect(reorderSortableValue(TASKS, getTaskId, "b", "b")).toBeNull();
		expect(reorderSortableValue(TASKS, getTaskId, "b", "missing")).toBeNull();
		expect(reorderSortableValue(TASKS, getTaskId, "missing", "a")).toBeNull();
	});

	it("never mutates the input list", (): void => {
		const before = ids(TASKS);
		reorderSortableValue(TASKS, getTaskId, "c", "a");
		expect(ids(TASKS)).toEqual(before);
	});
});

describe("findDuplicateId", () => {
	it("reports the first repeated id", (): void => {
		expect(findDuplicateId(["a", "b", "a", "b"])).toBe("a");
		expect(findDuplicateId(["a", "b"])).toBeUndefined();
	});
});

describe("createDragAndDropAccessibility", () => {
	it("builds announcements and instructions from the labels", (): void => {
		const accessibility = createDragAndDropAccessibility(LABELS, undefined);
		expect(accessibility.screenReaderInstructions?.draggable).toBe(LABELS.instructions);
		const active = { id: "a", data: { current: undefined }, rect: { current: { initial: null, translated: null } } };
		expect(accessibility.announcements?.onDragStart({ active })).toBe(LABELS.pickedUp("a"));
		expect(accessibility.announcements?.onDragCancel({ active, over: null })).toBe(LABELS.cancelled("a"));
		expect(accessibility.announcements?.onDragEnd({ active, over: null })).toBe(LABELS.droppedOutside("a"));
	});

	it("lets the caller's own accessibility settings win", (): void => {
		const accessibility = createDragAndDropAccessibility(LABELS, { screenReaderInstructions: { draggable: "Custom" } });
		expect(accessibility.screenReaderInstructions?.draggable).toBe("Custom");
	});
});

describe("Sortable", () => {
	it("renders the list, its items and handles with their slots", (): void => {
		renderSortable();
		const handle = screen.getByLabelText("Drag Alpha");
		expect(handle.dataset.slot).toBe("sortable-item-handle");
		const item = handle.closest<HTMLElement>("[data-slot=sortable-item]");
		expect(item?.dataset.value).toBe("a");
		expect(item?.getAttribute("aria-roledescription")).toBe("sortable");
		expect(item?.closest("[data-slot=sortable]")).not.toBeNull();
	});

	it("tells screen-reader users how to drag, from the kit labels", (): void => {
		renderSortable();
		const item = screen.getByLabelText("Drag Alpha").closest<HTMLElement>("[data-slot=sortable-item]");
		const describedBy = item?.getAttribute("aria-describedby") ?? "";
		expect(document.getElementById(describedBy)?.textContent).toBe(LABELS.instructions);
	});

	it("uses a per-usage label override", (): void => {
		renderSortable({ labels: { instructions: "Press Space to lift a row." } });
		expect(screen.getByText("Press Space to lift a row.")).toBeTruthy();
	});

	it("marks a disabled item with the disabled state", (): void => {
		renderSortable();
		const item = screen.getByLabelText("Drag Charlie").closest<HTMLElement>("[data-slot=sortable-item]");
		expect(item?.dataset.disabled).toBe("");
		expect(item?.className).toContain("opacity-50");
		expect(screen.getByLabelText("Drag Alpha").closest<HTMLElement>("[data-slot=sortable-item]")?.dataset.disabled).toBeUndefined();
	});

	it("reorders with the keyboard sensor: Space lifts, ArrowDown moves, Space drops", async (): Promise<void> => {
		stubItemLayout();
		const onValueChange = vi.fn<(value: Task[]) => void>();
		const onValueCommit = vi.fn<(value: Task[], meta: SortableCommitMeta<Task>) => void>();
		const onDragStart = vi.fn<() => void>();
		renderSortable({ onValueChange, onValueCommit, onDragStart });

		const handle = screen.getByLabelText("Drag Alpha");
		handle.focus();
		fireEvent.keyDown(handle, { code: "Space", key: " " });
		await flushTasks();
		expect(onDragStart).toHaveBeenCalledTimes(1);

		fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
		await flushTasks();
		fireEvent.keyDown(document, { code: "Space", key: " " });
		await flushTasks();

		expect(onValueChange).toHaveBeenCalledTimes(1);
		const next = onValueChange.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first] ?? [];
		expect(ids(next)).toEqual(["b", "a", "c"]);
		const meta = onValueCommit.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second];
		expect(meta?.activeIndex).toBe(0);
		expect(meta?.overIndex).toBe(1);
		expect(meta === undefined ? [] : ids(meta.previousValue)).toEqual(["a", "b", "c"]);
	});

	it("hands the move to onMove instead of changing the value", async (): Promise<void> => {
		stubItemLayout();
		const onValueChange = vi.fn<(value: Task[]) => void>();
		const onMove = vi.fn<() => void>();
		renderSortable({ onValueChange, onMove });

		const handle = screen.getByLabelText("Drag Alpha");
		fireEvent.keyDown(handle, { code: "Space", key: " " });
		await flushTasks();
		fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
		await flushTasks();
		fireEvent.keyDown(document, { code: "Space", key: " " });
		await flushTasks();

		expect(onMove).toHaveBeenCalledTimes(1);
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("cancels a keyboard drag with Escape and keeps the order", async (): Promise<void> => {
		stubItemLayout();
		const onValueChange = vi.fn<(value: Task[]) => void>();
		const onDragCancel = vi.fn<() => void>();
		renderSortable({ onValueChange, onDragCancel });

		fireEvent.keyDown(screen.getByLabelText("Drag Alpha"), { code: "Space", key: " " });
		await flushTasks();
		fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
		await flushTasks();
		fireEvent.keyDown(document, { code: "Escape", key: "Escape" });
		await flushTasks();

		expect(onDragCancel).toHaveBeenCalledTimes(1);
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("forwards refs and merges className last on every part", (): void => {
		const rootRef = React.createRef<HTMLDivElement>();
		const itemRef = React.createRef<HTMLDivElement>();
		const handleRef = React.createRef<HTMLDivElement>();
		render(
			<Sortable<Task> ref={rootRef} value={TASKS} onValueChange={noop} getItemValue={getTaskId} className="root-extra">
				<SortableItem ref={itemRef} value="a" className="item-extra">
					<SortableItemHandle ref={handleRef} className="handle-extra">
						Alpha
					</SortableItemHandle>
				</SortableItem>
			</Sortable>,
			{ wrapper: UiKitTestProviders },
		);
		expect([rootRef, itemRef, handleRef].map((ref) => ref.current?.dataset.slot)).toEqual(["sortable", "sortable-item", "sortable-item-handle"]);
		expect(rootRef.current?.className).toContain("root-extra");
		expect(itemRef.current?.className).toContain("item-extra");
		expect(handleRef.current?.className).toMatch(/cursor-grab! handle-extra$/);
	});
});
