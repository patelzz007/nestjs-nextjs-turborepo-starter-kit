// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cancelActiveFilterDrags, isFilterDropNoop, resolveFilterDrop, useFilterRowDrag, type FilterDropBox, type FilterDropDetails } from "../filters-dnd";

function box(top: number, bottom: number, parentId: string, index: number, depth: number): FilterDropBox {
	return { top, bottom, left: 0, right: 100, parentId, index, depth };
}

const ROWS: readonly FilterDropBox[] = [box(0, 20, "root", 0, 0), box(26, 46, "root", 1, 0), box(30, 40, "g1", 0, 1)];
const ZONE: readonly FilterDropBox[] = [box(100, 120, "root", 2, 0)];

afterEach((): void => {
	cleanup();
	cancelActiveFilterDrags();
});

describe("resolveFilterDrop", () => {
	it("prefers zones, then the deepest row, by midpoint", (): void => {
		expect(resolveFilterDrop(ZONE, ROWS, 10, 110)).toEqual({ target: ZONE[LIST_SLOT_INDEX.first], edge: null });
		expect(resolveFilterDrop(ZONE, ROWS, 10, 5)).toEqual({ target: { ...box(0, 20, "root", 0, 0) }, edge: "before" });
		expect(resolveFilterDrop(ZONE, ROWS, 10, 15)?.target.index).toBe(1);
		expect(resolveFilterDrop(ZONE, ROWS, 10, 36)?.target.parentId).toBe("g1");
	});

	it("tiles the seam between rows and misses empty space", (): void => {
		expect(resolveFilterDrop([], ROWS, 10, 23)?.edge).toBe("after");
		expect(resolveFilterDrop([], ROWS, 10, 23, 0)).toBeNull();
		expect(resolveFilterDrop([], ROWS, 500, 5)).toBeNull();
	});
});

describe("isFilterDropNoop", () => {
	it("treats a drop on either side of the origin as a no-op unless copying", (): void => {
		const origin = { parentId: "root", index: 1 };
		const here = { target: box(0, 1, "root", 1, 0), edge: null };
		const after = { target: box(0, 1, "root", 2, 0), edge: null };
		const elsewhere = { target: box(0, 1, "g1", 1, 0), edge: null };
		expect(isFilterDropNoop(here, origin, false)).toBe(true);
		expect(isFilterDropNoop(after, origin, false)).toBe(true);
		expect(isFilterDropNoop(here, origin, true)).toBe(false);
		expect(isFilterDropNoop(elsewhere, origin, false)).toBe(false);
		expect(isFilterDropNoop(null, origin, false)).toBe(false);
	});
});

interface HarnessProps {
	readonly onDrop: (nodeId: string, details: FilterDropDetails) => void;
}

function rect(top: number, height: number): DOMRect {
	return DOMRect.fromRect({ x: 0, y: top, width: 200, height });
}

function DragHarness({ onDrop }: HarnessProps): React.JSX.Element {
	const rootRef = React.useRef<HTMLDivElement | null>(null);
	const getRoot = React.useCallback((): HTMLDivElement | null => rootRef.current, []);
	const drag = useFilterRowDrag({ root: getRoot, onDrop });
	const first = drag("a");
	return (
		<div ref={rootRef}>
			<div data-slot="filter-row" data-node-id="a" data-parent-id="root" data-index="0">
				<button type="button" onPointerDown={first.onPointerDown}>
					grip
				</button>
			</div>
			<div data-slot="filter-row" data-node-id="b" data-parent-id="root" data-index="1">
				b
			</div>
		</div>
	);
}

describe("useFilterRowDrag", () => {
	it("moves a row past its neighbour and reports the drop", (): void => {
		const onDrop = vi.fn<(nodeId: string, details: FilterDropDetails) => void>();
		render(<DragHarness onDrop={onDrop} />);
		const [rowA, rowB] = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="filter-row"]'));
		if (rowA === undefined || rowB === undefined) {
			throw new Error("rows missing");
		}
		vi.spyOn(rowA, "getBoundingClientRect").mockReturnValue(rect(0, 20));
		vi.spyOn(rowB, "getBoundingClientRect").mockReturnValue(rect(30, 20));
		const grip = screen.getByRole("button", { name: "grip" });
		act((): void => {
			fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 10, clientY: 10, pointerType: "mouse" });
			window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 10, clientY: 45 }));
		});
		expect(rowA.dataset.dragging).toBe("");
		expect(rowB.dataset.dropEdge).toBe("after");
		expect(document.querySelector('[data-slot="filters-drag-carry"]')).not.toBeNull();
		act((): void => {
			window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: 10, clientY: 45 }));
		});
		expect(onDrop).toHaveBeenCalledWith("a", { parentId: "root", index: 2, copy: false });
		expect(document.querySelector('[data-slot="filters-drag-carry"]')).toBeNull();
		expect(rowA.dataset.dragging).toBeUndefined();
	});

	it("stays a click below the travel threshold and cancels on Escape", (): void => {
		const onDrop = vi.fn<(nodeId: string, details: FilterDropDetails) => void>();
		render(<DragHarness onDrop={onDrop} />);
		const grip = screen.getByRole("button", { name: "grip" });
		act((): void => {
			fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 10, clientY: 10, pointerType: "mouse" });
			window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, clientX: 11, clientY: 11 }));
			window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, clientX: 11, clientY: 11 }));
		});
		expect(onDrop).not.toHaveBeenCalled();
		act((): void => {
			fireEvent.pointerDown(grip, { pointerId: 2, button: 0, clientX: 10, clientY: 10, pointerType: "mouse" });
			window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 2, clientX: 10, clientY: 60 }));
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
			window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2, clientX: 10, clientY: 60 }));
		});
		expect(onDrop).not.toHaveBeenCalled();
		expect(document.querySelector('[data-slot="filters-drag-carry"]')).toBeNull();
	});
});
