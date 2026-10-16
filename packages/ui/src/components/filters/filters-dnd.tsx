"use client";

import { isBrowserRuntime } from "@workspace/shared";
import * as React from "react";

/**
 * Pointer-based drag layer for the advanced condition builder: a carry clone
 * that follows the pointer, drop indicators between rows and into groups, and
 * Alt to copy. Vanilla-DOM overlay, so a drag renders no React; the geometry is
 * pure (`resolveFilterDrop`, `isFilterDropNoop`) and table-tested.
 */

export interface FilterDndActivation {
	/** Mouse travel before a press becomes a drag. Below this it stays a click. */
	readonly moveDistancePx: number;
	/** Touch long-press before a drag starts, so a swipe still scrolls. */
	readonly touchDelayMs: number;
	readonly touchTolerancePx: number;
	readonly autoScrollEdgePx: number;
	readonly autoScrollMaxStepPx: number;
	/** A seed only: the carry measures the real grab offset before paint. */
	readonly carryPointerOffsetPx: number;
	/** How long after a drag a trailing click is still the drag's. */
	readonly trailingClickWindowMs: number;
}

export const FILTER_DND_ACTIVATION: FilterDndActivation = {
	moveDistancePx: 5,
	touchDelayMs: 250,
	touchTolerancePx: 5,
	autoScrollEdgePx: 40,
	autoScrollMaxStepPx: 12,
	carryPointerOffsetPx: 12,
	trailingClickWindowMs: 250,
};

/** One rule row, or one group's header row. Both are drag sources and targets. */
export const FILTER_ROW_SELECTOR = '[data-slot="filter-row"]';

/** Explicit "drop INSIDE": a row hit test can only ever say "beside". */
export const FILTER_DROP_ZONE_SELECTOR = "[data-drop-parent]";

/** Marked alongside the zone, so lighting the group costs no `:has()`. */
export const FILTER_GROUP_SELECTOR = '[data-slot="filter-group"]';

/** Geometry only, so resolution is a pure function and a table test. */
export interface FilterDropBox {
	readonly top: number;
	readonly bottom: number;
	readonly left: number;
	readonly right: number;
	/** The group the drop writes into. */
	readonly parentId: string;
	/** Where in that group's children the node lands. */
	readonly index: number;
	/** How many rows enclose this box. Deeper wins. */
	readonly depth: number;
}

export type FilterDropEdge = "before" | "after";

export interface FilterDropResolution<T extends FilterDropBox> {
	readonly target: T;
	/** Null for a zone: INTO the group rather than beside anything. */
	readonly edge: FilterDropEdge | null;
}

function contains(box: FilterDropBox, x: number, y: number, grow: number): boolean {
	return x >= box.left && x <= box.right && y >= box.top - grow && y <= box.bottom + grow;
}

/**
 * How far a ROW reaches past its own rect when hit tested: HALF the sibling
 * gap (`gap-3`), so adjacent rows tile and the seam between them is a target.
 */
export const FILTER_ROW_SEAM_PX = 6;

/** Half, for the midpoint test that decides before / after. */
const HALF = 2;

function deepest<T extends FilterDropBox>(boxes: readonly T[], x: number, y: number, grow: number): T | null {
	let best: T | null = null;
	for (const candidate of boxes) {
		if (contains(candidate, x, y, grow) && (best === null || candidate.depth > best.depth)) {
			best = candidate;
		}
	}
	return best;
}

/**
 * Zones before rows, then the DEEPEST box: a group's rect encloses everything
 * it holds, so a nested condition would otherwise resolve to its whole group.
 */
export function resolveFilterDrop<T extends FilterDropBox>(
	zones: readonly T[],
	rows: readonly T[],
	x: number,
	y: number,
	seam: number = FILTER_ROW_SEAM_PX,
): FilterDropResolution<T> | null {
	const zone = deepest(zones, x, y, 0);
	if (zone !== null) {
		return { target: zone, edge: null };
	}
	const row = deepest(rows, x, y, seam);
	if (row === null) {
		return null;
	}
	// The midpoint, not the nearest edge: a row is the width of the panel.
	const after = y > row.top + (row.bottom - row.top) / HALF;
	return { target: { ...row, index: row.index + (after ? 1 : 0) }, edge: after ? "after" : "before" };
}

/** Where a dragged node started, which is what makes a drop a no-op or not. */
export interface FilterDropOrigin {
	readonly parentId: string;
	readonly index: number;
}

/**
 * Both indices name the slot the node already occupies, because a move closes
 * the gap the detach leaves. Copy is never a no-op.
 */
export function isFilterDropNoop(resolution: FilterDropResolution<FilterDropBox> | null, origin: FilterDropOrigin | null, copy: boolean): boolean {
	if (resolution === null || origin === null || copy || resolution.target.parentId !== origin.parentId) {
		return false;
	}
	return resolution.target.index === origin.index || resolution.target.index === origin.index + 1;
}

/** Rows unmount mid-gesture, so it is the PANEL leaving that aborts a drag. */
const activeCancels = new Set<() => void>();

/** Cancel and fully revert every in-flight filter row drag. */
export function cancelActiveFilterDrags(): void {
	for (const cancel of [...activeCancels]) {
		cancel();
	}
}

let lastDragEndedAt = Number.NEGATIVE_INFINITY;

/** Whether a drag ended within the last few frames. */
export function wasRecentFilterDrag(): boolean {
	return performance.now() - lastDragEndedAt < FILTER_DND_ACTIVATION.trailingClickWindowMs;
}

function suppressTrailingClick(event: MouseEvent): void {
	window.removeEventListener("click", suppressTrailingClick, true);
	if (!wasRecentFilterDrag()) {
		return;
	}
	event.stopPropagation();
	event.preventDefault();
}

/** The carry is a compositing layer: a subpixel translate blurs its text. */
function snapToPixel(value: number): number {
	const ratio = isBrowserRuntime() && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
	return Math.round(value * ratio) / ratio;
}

interface MeasuredBox extends FilterDropBox {
	readonly el: HTMLElement;
	/** A ZONE's group card; null on a row, which stands for itself. */
	readonly card: HTMLElement | null;
}

interface Surface {
	readonly zones: readonly MeasuredBox[];
	readonly rows: readonly MeasuredBox[];
	/** Rects are captured ONCE; scrolling is corrected against this element's scrollTop. */
	readonly viewport: HTMLElement | null;
	readonly viewportRect: DOMRect | null;
	readonly startScrollTop: number;
}

const SCROLLABLE_OVERFLOW = /(?:auto|scroll|overlay)/;

/** The nearest scroller, THIS ONE INCLUDED. */
function findScrollParent(el: HTMLElement): HTMLElement | null {
	let node: HTMLElement | null = el;
	while (node !== null) {
		const style = getComputedStyle(node);
		if (SCROLLABLE_OVERFLOW.test(`${style.overflowY} ${style.overflow}`) && node.scrollHeight > node.clientHeight) {
			return node;
		}
		node = node.parentElement;
	}
	return null;
}

function rowDepth(el: HTMLElement, root: HTMLElement): number {
	let depth = 0;
	let node = el.parentElement;
	while (node !== null && node !== root) {
		if (node.matches(FILTER_ROW_SELECTOR)) {
			depth += 1;
		}
		node = node.parentElement;
	}
	return depth;
}

function measure(el: HTMLElement, root: HTMLElement, parentId: string, index: number, card: HTMLElement | null): MeasuredBox {
	const rect = el.getBoundingClientRect();
	return { el, card, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, parentId, index, depth: rowDepth(el, root) };
}

/**
 * Measured once. DESCENDANTS of the dragged node are excluded: an indicator the
 * drop ignores is a broken promise. The dragged row ITSELF is kept, so its own
 * slot reads as a no-op.
 */
function collectSurface(root: HTMLElement, dragged: HTMLElement): Surface {
	const zones: MeasuredBox[] = [];
	const rows: MeasuredBox[] = [];
	for (const el of root.querySelectorAll<HTMLElement>(FILTER_DROP_ZONE_SELECTOR)) {
		const parentId = el.dataset.dropParent;
		if (dragged.contains(el) || parentId === undefined || parentId === "") {
			continue;
		}
		zones.push(measure(el, root, parentId, Number(el.dataset.dropIndex ?? 0), el.closest<HTMLElement>(FILTER_GROUP_SELECTOR)));
	}
	for (const el of root.querySelectorAll<HTMLElement>(FILTER_ROW_SELECTOR)) {
		const parentId = el.dataset.parentId;
		if ((el !== dragged && dragged.contains(el)) || parentId === undefined || parentId === "") {
			continue;
		}
		rows.push(measure(el, root, parentId, Number(el.dataset.index ?? 0), null));
	}
	const viewport = findScrollParent(root);
	return { zones, rows, viewport, viewportRect: viewport?.getBoundingClientRect() ?? null, startScrollTop: viewport?.scrollTop ?? 0 };
}

export interface FilterDropDetails {
	readonly parentId: string;
	readonly index: number;
	/** Alt was held at release: copy the node rather than moving it. */
	readonly copy: boolean;
}

export interface FilterRowDragOptions {
	/** The PANEL, not its body: the top-level append zone is in the footer. */
	readonly root: () => HTMLElement | null;
	readonly onDrop: (nodeId: string, details: FilterDropDetails) => void;
	readonly disabled?: boolean | undefined;
}

/** Straight to the DOM: a React state write per move is a tree render. */
function paint(surface: Surface, hit: FilterDropResolution<MeasuredBox> | null): void {
	for (const box of surface.zones) {
		delete box.el.dataset.dropInto;
		if (box.card !== null) {
			delete box.card.dataset.dropInto;
		}
	}
	for (const box of surface.rows) {
		delete box.el.dataset.dropEdge;
	}
	if (hit === null) {
		return;
	}
	if (hit.edge !== null) {
		hit.target.el.dataset.dropEdge = hit.edge;
		return;
	}
	hit.target.el.dataset.dropInto = "";
	if (hit.target.card !== null) {
		hit.target.card.dataset.dropInto = "";
	}
}

/** The carry's static styles: one string Tailwind can see at build time. */
const CARRY_CLASS =
	"pointer-events-none fixed top-0 left-0 z-toast opacity-95 will-change-transform data-drop-invalid:opacity-60 data-drop-invalid:ring-2 data-drop-invalid:ring-destructive/70";
const CARRY_CLIP_CLASS = "overflow-hidden rounded-md bg-background";
const CARRY_BADGE_CLASS = "absolute -end-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-badge-xs leading-none text-primary-foreground";
/** The copy badge's glyph: decorative (`aria-hidden`), not copy. */
const CARRY_COPY_GLYPH = "+";

/** SANITIZED, because the clone lives on `<body>`: no ids, no node ids, no tab stops. */
function stripClone(el: HTMLElement): void {
	el.removeAttribute("id");
	el.removeAttribute("data-node-id");
	el.removeAttribute("data-filter-cell");
	if (el.dataset.slot === "filter-row") {
		el.removeAttribute("data-slot");
	}
	el.setAttribute("tabindex", "-1");
}

interface Carry {
	readonly el: HTMLDivElement;
	readonly badge: HTMLSpanElement;
	readonly grabOffsetX: number;
	readonly grabOffsetY: number;
}

function createCarry(source: HTMLElement, startX: number, startY: number, copy: boolean): Carry | null {
	const rect = source.getBoundingClientRect();
	const clone = source.cloneNode(true);
	if (!(clone instanceof HTMLElement)) {
		return null;
	}
	delete clone.dataset.dragging;
	delete clone.dataset.dropNoop;
	delete clone.dataset.dropEdge;
	if (rect.width > 0) {
		clone.style.width = `${String(rect.width)}px`;
	}
	stripClone(clone);
	for (const el of clone.querySelectorAll<HTMLElement>("*")) {
		stripClone(el);
	}

	const el = document.createElement("div");
	el.setAttribute("data-slot", "filters-drag-carry");
	el.setAttribute("aria-hidden", "true");
	el.className = CARRY_CLASS;

	const clip = document.createElement("div");
	clip.className = CARRY_CLIP_CLASS;
	if (rect.width > 0) {
		clip.style.width = `${String(rect.width)}px`;
	}
	if (rect.height > 0) {
		clip.style.height = `${String(rect.height)}px`;
	}
	clip.appendChild(clone);
	el.appendChild(clip);

	const badge = document.createElement("span");
	badge.setAttribute("data-slot", "filters-drag-copy");
	badge.className = CARRY_BADGE_CLASS;
	badge.textContent = CARRY_COPY_GLYPH;
	badge.hidden = !copy;
	el.appendChild(badge);

	// <body>, not the panel: a transformed ancestor would become the containing block.
	document.body.appendChild(el);
	return { el, badge, grabOffsetX: startX - rect.left, grabOffsetY: startY - rect.top };
}

type DropState = "ok" | "noop" | "none";

/** The mutable state of one gesture, owned by `startDrag`'s closures. */
interface Gesture {
	active: boolean;
	finished: boolean;
	surface: Surface | null;
	hit: FilterDropResolution<MeasuredBox> | null;
	copy: boolean;
	lastX: number | null;
	lastY: number | null;
	touchTimer: ReturnType<typeof setTimeout> | null;
	rafScroll: number;
	dropState: DropState;
	carry: Carry | null;
}

function startDrag(event: React.PointerEvent<HTMLElement>, nodeId: string, options: FilterRowDragOptions): void {
	const handle = event.currentTarget;
	const root = options.root();
	const source = handle.closest<HTMLElement>(FILTER_ROW_SELECTOR);
	if (root === null || source === null) {
		return;
	}
	const { pointerId, clientX: startX, clientY: startY } = event;
	const isTouch = event.pointerType === "touch";
	const originParent = source.dataset.parentId;
	const origin: FilterDropOrigin | null = originParent === undefined || originParent === "" ? null : { parentId: originParent, index: Number(source.dataset.index ?? 0) };
	const gesture: Gesture = {
		active: false,
		finished: false,
		surface: null,
		hit: null,
		copy: event.altKey,
		lastX: null,
		lastY: null,
		touchTimer: null,
		rafScroll: 0,
		dropState: "none",
		carry: null,
	};

	const positionCarry = (x: number, y: number): void => {
		const { carry } = gesture;
		if (carry === null) {
			return;
		}
		carry.el.style.transform = `translate3d(${String(snapToPixel(x - carry.grabOffsetX))}px, ${String(snapToPixel(y - carry.grabOffsetY))}px, 0)`;
	};

	// The RESOLUTION outranks Alt: `copy` over nothing is still nothing.
	const paintCursor = (): void => {
		if (!gesture.active) {
			return;
		}
		document.body.style.cursor = gesture.dropState === "none" ? "no-drop" : gesture.copy ? "copy" : "grabbing";
	};

	const setDropState = (next: DropState): void => {
		gesture.dropState = next;
		if (next === "noop") {
			source.dataset.dropNoop = "";
		} else {
			delete source.dataset.dropNoop;
		}
		const { carry } = gesture;
		if (carry !== null) {
			if (next === "none") {
				carry.el.dataset.dropInvalid = "";
			} else {
				delete carry.el.dataset.dropInvalid;
			}
		}
		paintCursor();
	};

	const hitTest = (x: number, y: number): void => {
		const { surface } = gesture;
		if (surface === null) {
			return;
		}
		const drift = (surface.viewport?.scrollTop ?? surface.startScrollTop) - surface.startScrollTop;
		const resolved = resolveFilterDrop(surface.zones, surface.rows, x, y + drift);
		const noop = isFilterDropNoop(resolved, origin, gesture.copy);
		// A no-op commits as NOTHING, not as a move the tree would discard.
		gesture.hit = noop ? null : resolved;
		paint(surface, gesture.hit);
		setDropState(noop ? "noop" : gesture.hit === null ? "none" : "ok");
	};

	const retest = (): void => {
		if (gesture.lastX !== null && gesture.lastY !== null) {
			hitTest(gesture.lastX, gesture.lastY);
		}
	};

	const setCopy = (next: boolean): void => {
		if (gesture.copy === next) {
			return;
		}
		gesture.copy = next;
		if (gesture.carry !== null) {
			gesture.carry.badge.hidden = !next;
		}
		paintCursor();
		// Alt changes the ANSWER, not just the cursor.
		retest();
	};

	const autoScroll = (y: number): void => {
		if (gesture.rafScroll !== 0) {
			cancelAnimationFrame(gesture.rafScroll);
		}
		gesture.rafScroll = 0;
		const viewport = gesture.surface?.viewport ?? null;
		const rect = gesture.surface?.viewportRect ?? null;
		if (viewport === null || rect === null) {
			return;
		}
		const edge = FILTER_DND_ACTIVATION.autoScrollEdgePx;
		const step = FILTER_DND_ACTIVATION.autoScrollMaxStepPx;
		let delta = 0;
		if (y >= rect.top && y < rect.top + edge) {
			delta = -step * ((rect.top + edge - y) / edge);
		} else if (y <= rect.bottom && y > rect.bottom - edge) {
			delta = step * Math.min(1, (y - (rect.bottom - edge)) / edge);
		}
		if (delta === 0) {
			return;
		}
		const tick = (): void => {
			// The read-back STOPS the loop at the scroll extent.
			const before = viewport.scrollTop;
			viewport.scrollTop = before + delta;
			if (viewport.scrollTop === before) {
				return;
			}
			retest();
			gesture.rafScroll = requestAnimationFrame(tick);
		};
		gesture.rafScroll = requestAnimationFrame(tick);
	};

	/** A still pointer fires no `pointermove`, so a wheel mid-drag re-tests here. */
	const onViewportScroll = (): void => {
		if (gesture.active) {
			retest();
		}
	};

	const onWindowBlur = (): void => {
		cancel();
	};

	const activate = (): void => {
		if (gesture.active) {
			return;
		}
		gesture.active = true;
		gesture.surface = collectSurface(root, source);
		gesture.surface.viewport?.addEventListener("scroll", onViewportScroll, { passive: true });
		source.dataset.dragging = "";
		document.body.style.cursor = gesture.copy ? "copy" : "grabbing";
		document.body.style.userSelect = "none";
		gesture.carry = createCarry(source, startX, startY, gesture.copy);
		positionCarry(startX, startY);
		window.addEventListener("blur", onWindowBlur);
	};

	// Idempotent: pointerup, pointercancel, Escape, blur and teardown can all race.
	const cleanup = (): void => {
		if (gesture.finished) {
			return;
		}
		gesture.finished = true;
		activeCancels.delete(cancel);
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerCancel);
		window.removeEventListener("keydown", onKeyDown, true);
		window.removeEventListener("keyup", onKeyUp, true);
		window.removeEventListener("blur", onWindowBlur);
		gesture.surface?.viewport?.removeEventListener("scroll", onViewportScroll);
		if (gesture.touchTimer !== null) {
			clearTimeout(gesture.touchTimer);
		}
		if (gesture.rafScroll !== 0) {
			cancelAnimationFrame(gesture.rafScroll);
		}
		if (gesture.surface !== null) {
			paint(gesture.surface, null);
		}
		delete source.dataset.dragging;
		delete source.dataset.dropNoop;
		gesture.carry?.el.remove();
		gesture.carry = null;
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	};

	/** A bare teardown: nothing is committed until release. */
	function cancel(): void {
		if (gesture.active) {
			lastDragEndedAt = performance.now();
		}
		cleanup();
	}

	function onKeyDown(keyEvent: KeyboardEvent): void {
		if (keyEvent.key === "Escape" && gesture.active) {
			// Stopped, or a surrounding popover closes underneath the gesture.
			keyEvent.stopPropagation();
			keyEvent.preventDefault();
			cancel();
			return;
		}
		if (keyEvent.key === "Alt") {
			setCopy(true);
		}
	}

	function onKeyUp(keyEvent: KeyboardEvent): void {
		if (keyEvent.key === "Alt") {
			setCopy(false);
		}
	}

	function onPointerMove(moveEvent: PointerEvent): void {
		// A second finger must not drive or cancel the gesture this one started.
		if (moveEvent.pointerId !== pointerId) {
			return;
		}
		gesture.lastX = moveEvent.clientX;
		gesture.lastY = moveEvent.clientY;
		if (!gesture.active) {
			const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
			if (isTouch) {
				// Past the tolerance the user is scrolling.
				if (distance > FILTER_DND_ACTIVATION.touchTolerancePx) {
					cancel();
				}
				return;
			}
			if (distance < FILTER_DND_ACTIVATION.moveDistancePx) {
				return;
			}
			activate();
		}
		setCopy(moveEvent.altKey);
		positionCarry(moveEvent.clientX, moveEvent.clientY);
		hitTest(moveEvent.clientX, moveEvent.clientY);
		autoScroll(moveEvent.clientY);
	}

	function onPointerUp(upEvent: PointerEvent): void {
		if (upEvent.pointerId !== pointerId) {
			return;
		}
		const wasActive = gesture.active;
		const landed = wasActive ? gesture.hit : null;
		const wasCopy = gesture.copy;
		cleanup();
		if (!wasActive) {
			return;
		}
		lastDragEndedAt = performance.now();
		// The trailing click belongs to the gesture, not to whatever it ended over.
		window.addEventListener("click", suppressTrailingClick, true);
		if (landed === null) {
			return;
		}
		options.onDrop(nodeId, { parentId: landed.target.parentId, index: landed.target.index, copy: wasCopy });
	}

	function onPointerCancel(cancelEvent: PointerEvent): void {
		if (cancelEvent.pointerId === pointerId) {
			cancel();
		}
	}

	window.addEventListener("pointermove", onPointerMove);
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("pointercancel", onPointerCancel);
	window.addEventListener("keydown", onKeyDown, true);
	window.addEventListener("keyup", onKeyUp, true);
	activeCancels.add(cancel);

	if (isTouch) {
		gesture.touchTimer = setTimeout((): void => {
			activate();
			if (gesture.lastX !== null && gesture.lastY !== null) {
				positionCarry(gesture.lastX, gesture.lastY);
				hitTest(gesture.lastX, gesture.lastY);
			}
		}, FILTER_DND_ACTIVATION.touchDelayMs);
	}
}

/** The props a drag handle spreads. */
export interface FilterRowDragHandleProps {
	readonly onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

/** The primary pointer button: a right press must not strand a drag under a menu. */
const PRIMARY_BUTTON = 0;

/**
 * Only `onPointerDown`: the handle is a real button that Tab reaches, so it must
 * not also be `draggable` and race the browser's HTML5 drag.
 */
export function useFilterRowDrag(options: FilterRowDragOptions): (nodeId: string) => FilterRowDragHandleProps {
	// Read at gesture time, so the handler identity is stable.
	const latest = React.useRef(options);
	React.useEffect((): void => {
		latest.current = options;
	});
	// A gesture outlives its row by design, but never the panel.
	React.useEffect((): (() => void) => cancelActiveFilterDrags, []);
	return React.useCallback(
		(nodeId: string): FilterRowDragHandleProps => ({
			onPointerDown: (event: React.PointerEvent<HTMLElement>): void => {
				if (latest.current.disabled === true || event.button !== PRIMARY_BUTTON) {
					return;
				}
				startDrag(event, nodeId, latest.current);
			},
		}),
		[],
	);
}
