"use client";

/**
 * The gantt's pointer + keyboard interaction engine: bar move, edge resize and
 * drag-create over the horizontal axis with live validation, plus the keyboard
 * move/resize contract of a focused bar. The maths lives in
 * `gantt-gesture-math.ts`; this module measures the DOM, positions the
 * cursor-following overlays imperatively (no per-frame React) and commits
 * through the store's one validation funnel (`applyProposedUpdate`).
 */
import * as React from "react";

import { useGantt, useGanttViewConfig } from "./gantt";
import {
	axisMinutesAt,
	computeBarGestureRange,
	computeCreateGestureRange,
	computeKeyboardStep,
	overlapsNeighbours,
	resolveKeyboardIntent,
	resolveOverlapPolicy,
	resolveSnapMinutes,
	type GanttAxisGeometry,
	type GanttGestureKind,
	type GanttGestureRange,
	type GanttKeyboardIntent,
	type GanttNeighbourSpan,
} from "./gantt-gesture-math";
import { findResource, MS_PER_DAY, MS_PER_MINUTE, toZoned } from "./gantt-lib";
import { resolveScheduleMode, type GanttInstance } from "./gantt-store";
import type { GanttDragKind, GanttOccurrence, GanttOverlapPolicy, GanttProposedUpdate, GanttScheduleMode, GanttSegment } from "./gantt-types";

/**
 * Activation policy (dnd-kit parity): mouse moves 5px before a drag starts
 * (below = click), create 4px; touch long-presses 250ms with 5px tolerance.
 */
export const GANTT_ACTIVATION: { readonly moveDistancePx: number; readonly createDistancePx: number; readonly touchDelayMs: number; readonly touchTolerancePx: number } = {
	moveDistancePx: 5,
	createDistancePx: 4,
	touchDelayMs: 250,
	touchTolerancePx: 5,
};

/** A click this soon after a gesture ended belongs to that gesture, not to the bar. */
const RECENT_GESTURE_MS = 250;
/** Pointer distance (px) from the timeline edge that pans it during a drag. */
const AUTO_SCROLL_EDGE_PX = 24;
/** Fastest auto-pan step, in px per frame. */
const AUTO_SCROLL_MAX_SPEED_PX = 14;
/** The primary mouse button. */
const PRIMARY_BUTTON = 0;
/** Fallback snap when the axis carries none (minutes). */
const FALLBACK_SNAP_MIN = 15;
/** Default bar colour token. */
export const GANTT_DEFAULT_COLOR = "var(--primary)";

const AXIS_SELECTOR = "[data-gantt-axis]";
const ROW_SELECTOR = "[data-gantt-row]";

/** Module flag so bar onClick can ignore the click that ends a drag. */
let lastGestureEndedAt = 0;

export function wasRecentDrag(): boolean {
	return performance.now() - lastGestureEndedAt < RECENT_GESTURE_MS;
}

/** Mark a non-dnd gesture (e.g. a timeline pan) so the click it ends is ignored. */
export function markGestureEnd(): void {
	lastGestureEndedAt = performance.now();
}

/** In-flight gesture cancels, so the VIEW can abort gestures whose measured geometry changed. */
const activeGestureCancels = new Set<() => void>();

/** Cancel (and fully revert) every in-flight gantt pointer gesture. */
export function cancelActiveGanttGestures(): void {
	for (const cancel of [...activeGestureCancels]) {
		cancel();
	}
}

/** View-level teardown: aborts any in-flight gesture on unmount. */
export function useGanttGestureTeardown(): void {
	React.useEffect((): (() => void) => cancelActiveGanttGestures, []);
}

/** Snap a translate offset to the device pixel grid so the composited overlay text stays crisp. */
function snapToPixel(value: number): number {
	const ratio = window.devicePixelRatio || 1;
	return Math.round(value * ratio) / ratio;
}

interface MeasuredRow {
	readonly resourceId: string;
	readonly top: number;
	readonly bottom: number;
}

interface GanttSurface {
	axis: GanttAxisGeometry;
	readonly rows: readonly MeasuredRow[];
}

function readAxisGeometry(axisElement: HTMLElement): GanttAxisGeometry {
	const rect = axisElement.getBoundingClientRect();
	const snap = Number(axisElement.dataset.ganttSnap);
	return {
		left: rect.left,
		right: rect.right,
		rangeStartMs: Number(axisElement.dataset.ganttRangeStart),
		rangeEndMs: Number(axisElement.dataset.ganttRangeEnd),
		snapMin: Number.isFinite(snap) && snap > 0 ? snap : FALLBACK_SNAP_MIN,
		isRtl: getComputedStyle(axisElement).direction === "rtl",
	};
}

function collectSurface(root: HTMLElement | null): GanttSurface | null {
	const axisElement = root?.querySelector<HTMLElement>(AXIS_SELECTOR) ?? null;
	if (root === null || axisElement === null) {
		return null;
	}
	const rows = [...root.querySelectorAll<HTMLElement>(ROW_SELECTOR)]
		// static rows (parents that aggregate their subtree) take no drops
		.filter((row: HTMLElement): boolean => row.dataset.ganttRowStatic === undefined)
		.map((row: HTMLElement): MeasuredRow => {
			const rect = row.getBoundingClientRect();
			return { resourceId: row.dataset.ganttResource ?? "", top: rect.top, bottom: rect.bottom };
		});
	return { axis: readAxisGeometry(axisElement), rows };
}

/** The row under y, or the one whose centre is closest. */
function rowAt(rows: readonly MeasuredRow[], y: number): MeasuredRow | undefined {
	let best: MeasuredRow | undefined;
	for (const row of rows) {
		if (y >= row.top && y < row.bottom) {
			return row;
		}
		const distance = Math.abs(y - (row.top + row.bottom) / 2);
		if (best === undefined || distance < Math.abs(y - (best.top + best.bottom) / 2)) {
			best = row;
		}
	}
	return best;
}

function releaseCapture(origin: HTMLElement, pointerId: number): void {
	try {
		if (origin.hasPointerCapture(pointerId)) {
			origin.releasePointerCapture(pointerId);
		}
	} catch (error: unknown) {
		// a detached origin or a vanished pointer throws a DOMException: capture is an enhancement
		if (!(error instanceof DOMException)) {
			throw error;
		}
	}
}

function capturePointer(origin: HTMLElement, pointerId: number): void {
	try {
		origin.setPointerCapture(pointerId);
	} catch (error: unknown) {
		// the pointer can already be gone (fast flicks, synthetic events): capture is an enhancement
		if (!(error instanceof DOMException)) {
			throw error;
		}
	}
}

/**
 * The cursor-following overlays live on document.body (no ancestor transform
 * or overflow can clip them), which cuts them off from the gantt root that owns
 * the type scale — so they adopt the root's resolved metrics.
 */
function adoptRootTypography(element: HTMLElement, ganttRoot: HTMLElement | null): void {
	if (ganttRoot === null) {
		return;
	}
	const rootStyle = getComputedStyle(ganttRoot);
	element.style.fontSize = rootStyle.fontSize;
	element.style.lineHeight = rootStyle.lineHeight;
	element.style.fontFamily = rootStyle.fontFamily;
	element.style.letterSpacing = rootStyle.letterSpacing;
	element.style.direction = rootStyle.direction;
}

const OVERLAY_CLASS = "pointer-events-none fixed top-0 left-0 z-popover flex items-center gap-2 will-change-transform";
const RESIZE_OVERLAY_CLASS = "pointer-events-none fixed top-0 left-0 z-popover will-change-transform";

function setEventColor(element: HTMLElement, color: string | undefined): void {
	element.style.setProperty("--gantt-event-color", color ?? GANTT_DEFAULT_COLOR);
}

function createMoveClone(occurrence: GanttOccurrence, width: number, height: number, ganttRoot: HTMLElement | null): HTMLDivElement {
	const overlay = document.createElement("div");
	overlay.setAttribute("data-slot", "gantt-drag-overlay");
	overlay.setAttribute("aria-hidden", "true");
	overlay.className = OVERLAY_CLASS;
	adoptRootTypography(overlay, ganttRoot);
	setEventColor(overlay, occurrence.event.color);
	overlay.style.height = `${String(height)}px`;
	const bar = document.createElement("div");
	bar.style.width = `${String(width)}px`;
	if (occurrence.end.getTime() === occurrence.start.getTime()) {
		// a MILESTONE stays a diamond while it travels
		bar.className = "flex h-full shrink-0 items-center justify-center";
		const diamond = document.createElement("span");
		diamond.className = "size-2.5 rotate-45 rounded-xs border border-(--gantt-event-color) bg-(--gantt-event-color)/80 shadow-lg";
		bar.appendChild(diamond);
	} else {
		bar.className = "h-full shrink-0 rounded-sm bg-(--gantt-event-color)/25 shadow-lg outline outline-(--gantt-event-color)/55";
	}
	overlay.appendChild(bar);
	const label = document.createElement("span");
	label.className = "truncate font-medium whitespace-nowrap text-foreground";
	label.textContent = occurrence.event.title;
	overlay.appendChild(label);
	document.body.appendChild(overlay);
	return overlay;
}

interface ResizeIndicator {
	readonly root: HTMLDivElement;
	readonly line: HTMLDivElement;
	readonly range: HTMLSpanElement;
	readonly dot: HTMLSpanElement;
	readonly duration: HTMLSpanElement;
}

function createResizeIndicator(occurrence: GanttOccurrence, height: number, ganttRoot: HTMLElement | null): ResizeIndicator {
	const root = document.createElement("div");
	root.setAttribute("data-slot", "gantt-resize-indicator");
	root.setAttribute("aria-hidden", "true");
	root.className = RESIZE_OVERLAY_CLASS;
	adoptRootTypography(root, ganttRoot);
	setEventColor(root, occurrence.event.color);
	root.style.height = `${String(height)}px`;
	const line = document.createElement("div");
	line.className = "h-full w-0.5 -translate-x-1/2 rounded-full bg-(--gantt-event-color) data-invalid:bg-destructive";
	root.appendChild(line);
	const chip = document.createElement("div");
	chip.className =
		"absolute bottom-full left-0 mb-1.5 flex -translate-x-1/2 items-center gap-1.5 rounded-md bg-foreground px-2 py-1 font-medium whitespace-nowrap text-background";
	const range = document.createElement("span");
	const dot = document.createElement("span");
	dot.className = "size-1 shrink-0 rounded-full bg-background/40";
	const duration = document.createElement("span");
	const arrow = document.createElement("span");
	arrow.className = "absolute -bottom-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-xs bg-foreground";
	chip.append(range, dot, duration, arrow);
	root.appendChild(chip);
	document.body.appendChild(root);
	return { root, line, range, dot, duration };
}

function writeIndicatorRange(indicator: ResizeIndicator, instance: GanttInstance, range: GanttGestureRange, allDay: boolean): void {
	const { settings } = instance;
	indicator.range.textContent = settings.i18n.functions.formatEventTime(
		toZoned(range.start, settings.timeZone),
		toZoned(range.end, settings.timeZone),
		allDay,
		settings.locale,
	);
	const days = Math.round((range.end.getTime() - range.start.getTime()) / MS_PER_DAY);
	const showDays = days >= 1;
	indicator.dot.hidden = !showDays;
	indicator.duration.hidden = !showDays;
	indicator.duration.textContent = showDays ? settings.i18n.labels.durationDays(days) : "";
}

/** Writes an accepted change to the gantt's polite live region. */
export function announceGanttUpdate(origin: Element | null, instance: GanttInstance, title: string, range: GanttGestureRange, allDay: boolean): void {
	const announcer = origin?.closest("[data-slot=gantt]")?.querySelector("[data-slot=gantt-announcer]");
	if (announcer === null || announcer === undefined) {
		return;
	}
	const { settings } = instance;
	const timeLabel = settings.i18n.functions.formatEventTime(toZoned(range.start, settings.timeZone), toZoned(range.end, settings.timeZone), allDay, settings.locale);
	announcer.textContent = settings.i18n.labels.announceUpdate(title, timeLabel);
}

/** The other schedules in the occurrence's own node, as epoch-ms spans. */
function collectNeighbours(instance: GanttInstance, occurrence: GanttOccurrence): GanttNeighbourSpan[] {
	const nodeId = occurrence.event.resourceId;
	if (nodeId === undefined) {
		return [];
	}
	return instance.api
		.getOccurrences()
		.filter((other: GanttOccurrence): boolean => other.event.resourceId === nodeId && other.key !== occurrence.key)
		.map((other: GanttOccurrence): GanttNeighbourSpan => ({ start: other.start.getTime(), end: other.end.getTime() }));
}

/** The overlap policy in force for an occurrence (a "single" node always rejects). */
function overlapPolicyFor(instance: GanttInstance, occurrence: GanttOccurrence, scheduleMode: GanttScheduleMode | undefined): GanttOverlapPolicy {
	const nodeId = occurrence.event.resourceId;
	const node = nodeId === undefined ? null : findResource(instance.settings.resources, nodeId);
	return resolveOverlapPolicy(resolveScheduleMode(node, scheduleMode) === "single", instance.settings.overlap);
}

function gestureSource(kind: GanttDragKind): GanttProposedUpdate["source"] {
	return kind === "move" ? "drag" : kind;
}

interface BeginGestureConfig {
	readonly instance: GanttInstance;
	readonly kind: GanttGestureKind;
	readonly origin: HTMLElement;
	readonly startEvent: PointerEvent;
	readonly segment?: GanttSegment | undefined;
	/** The consumer renders the move preview (renderDragPreview); the engine only positions it. */
	readonly customMoveOverlay?: boolean | undefined;
	/** The consumer renders the resize indicator; the engine only positions it. */
	readonly customResizeOverlay?: boolean | undefined;
	/** View-level cardinality default; a node's own scheduleMode wins. */
	readonly scheduleMode?: GanttScheduleMode | undefined;
}

/** Runs one pointer gesture from press to release (or cancel). */
function beginGesture(config: BeginGestureConfig): void {
	const { instance, kind, origin, startEvent, segment } = config;
	const { settings, internals, api } = instance;
	const activation = {
		moveDistancePx: settings.activation?.moveDistancePx ?? GANTT_ACTIVATION.moveDistancePx,
		createDistancePx: settings.activation?.createDistancePx ?? GANTT_ACTIVATION.createDistancePx,
		touchDelayMs: settings.activation?.touchDelayMs ?? GANTT_ACTIVATION.touchDelayMs,
		touchTolerancePx: settings.activation?.touchTolerancePx ?? GANTT_ACTIVATION.touchTolerancePx,
	};
	const startX = startEvent.clientX;
	const startY = startEvent.clientY;
	const pointerId = startEvent.pointerId;
	// stable ancestors: bar nodes may be replaced by re-renders mid-gesture
	const viewRoot = origin.closest<HTMLElement>("[data-slot=gantt-view]");
	const ganttRoot = origin.closest<HTMLElement>("[data-slot=gantt]");
	const occurrence = segment?.occurrence;
	const isTouch = startEvent.pointerType === "touch";
	const isResize = kind === "resize-start" || kind === "resize-end";
	const overlapPolicy: GanttOverlapPolicy = occurrence === undefined ? "allow" : overlapPolicyFor(instance, occurrence, config.scheduleMode);
	// read once per gesture: the gantt never mutates events mid-drag
	const neighbours = occurrence === undefined || overlapPolicy === "allow" ? [] : collectNeighbours(instance, occurrence);

	// resize activates immediately on precise pointers; touch waits for the long-press
	let active = isResize && !isTouch;
	let surface: GanttSurface | null = active ? collectSurface(viewRoot) : null;
	let lastProposalKey = "";
	let touchTimer: ReturnType<typeof setTimeout> | null = null;
	let lastPointer: PointerEvent = startEvent;
	let overlapRejected = false;
	let grabOffsetMin = 0;
	let grabOffsetPx = 0;
	let barTop = 0;
	let moveOverlay: HTMLDivElement | null = null;
	let resizeIndicator: ResizeIndicator | null = null;
	let customResizeElement: HTMLElement | null = null;
	let autoScrollFrame = 0;
	let finished = false;

	const positionMoveOverlay = (pointer: PointerEvent): void => {
		if (moveOverlay === null && config.customMoveOverlay === true && active && kind === "move") {
			moveOverlay = document.querySelector<HTMLDivElement>("[data-slot=gantt-drag-overlay][data-custom]");
			if (moveOverlay !== null) {
				moveOverlay.style.visibility = "visible";
			}
		}
		if (moveOverlay !== null) {
			moveOverlay.style.transform = `translate3d(${String(snapToPixel(pointer.clientX - grabOffsetPx))}px, ${String(snapToPixel(barTop))}px, 0)`;
		}
	};

	const positionResizeIndicator = (pointer: PointerEvent): void => {
		if (!isResize || surface === null) {
			return;
		}
		if (customResizeElement === null && config.customResizeOverlay === true) {
			customResizeElement = document.querySelector<HTMLElement>("[data-slot=gantt-resize-indicator][data-custom]");
			if (customResizeElement !== null) {
				customResizeElement.style.visibility = "visible";
			}
		}
		const target = resizeIndicator?.root ?? customResizeElement;
		if (target === null) {
			return;
		}
		const x = Math.min(Math.max(pointer.clientX, surface.axis.left), surface.axis.right);
		target.style.transform = `translate3d(${String(snapToPixel(x))}px, ${String(snapToPixel(barTop))}px, 0)`;
	};

	const mountResizeIndicator = (): void => {
		if (!isResize || occurrence === undefined || resizeIndicator !== null) {
			return;
		}
		const rect = (origin.closest<HTMLElement>("[data-slot=gantt-bar]") ?? origin).getBoundingClientRect();
		barTop = rect.top;
		if (config.customResizeOverlay !== true) {
			resizeIndicator = createResizeIndicator(occurrence, rect.height, ganttRoot);
			writeIndicatorRange(resizeIndicator, instance, occurrence, occurrence.allDay);
		}
		positionResizeIndicator(startEvent);
	};

	if (active) {
		mountResizeIndicator();
	}

	const gestureCursor = isResize ? "ew-resize" : "grabbing";
	const setBodyDragging = (isOn: boolean, isInvalid = false): void => {
		document.body.classList.toggle("gantt-dragging", isOn);
		document.body.style.cursor = isOn ? (isInvalid ? "not-allowed" : gestureCursor) : "";
		document.body.style.userSelect = isOn ? "none" : "";
	};

	const activate = (): void => {
		if (active) {
			return;
		}
		active = true;
		surface = collectSurface(viewRoot);
		mountResizeIndicator();
		if (kind === "move" && occurrence !== undefined && surface !== null) {
			// TRUE start, never clamped to the range, so a bar beginning before the window keeps its grab offset
			const occurrenceStartMin = (occurrence.start.getTime() - surface.axis.rangeStartMs) / MS_PER_MINUTE;
			grabOffsetMin = axisMinutesAt(surface.axis, startX) - occurrenceStartMin;
			const rect = origin.getBoundingClientRect();
			barTop = rect.top;
			grabOffsetPx = startX - rect.left;
			if (config.customMoveOverlay !== true && rect.width > 0) {
				moveOverlay = createMoveClone(occurrence, rect.width, rect.height, ganttRoot);
			}
			positionMoveOverlay(lastPointer);
		}
		setBodyDragging(true);
	};

	const applyProposal = (pointer: PointerEvent): void => {
		if (surface === null) {
			return;
		}
		if (kind === "create") {
			const range = computeCreateGestureRange({
				axis: surface.axis,
				anchorX: startX,
				pointerX: pointer.clientX,
				timeZone: settings.timeZone,
				slotDuration: settings.slotDuration,
			});
			const draft = { ...range, allDay: false, resourceId: rowAt(surface.rows, startY)?.resourceId };
			const key = `${String(draft.start.getTime())}-${String(draft.end.getTime())}`;
			if (key === lastProposalKey) {
				return;
			}
			lastProposalKey = key;
			if (settings.canSelectSlot?.(draft) === false) {
				return;
			}
			internals.setSlotDraft(draft);
			return;
		}
		if (occurrence === undefined) {
			return;
		}
		const range = computeBarGestureRange({
			kind,
			axis: surface.axis,
			occurrence,
			pointerX: pointer.clientX,
			grabOffsetMin,
			timeZone: settings.timeZone,
			overlap: overlapPolicy,
			neighbours,
		});
		const key = `${String(range.start.getTime())}-${String(range.end.getTime())}`;
		if (key === lastProposalKey) {
			return;
		}
		lastProposalKey = key;
		const update: GanttProposedUpdate = {
			event: occurrence.event,
			occurrence,
			...range,
			allDay: occurrence.allDay,
			resourceId: occurrence.event.resourceId,
			source: gestureSource(kind),
		};
		// "reject" is the one veto the engine owns: it styles the ghost AND blocks the commit
		overlapRejected = overlapPolicy === "reject" && overlapsNeighbours(range, neighbours);
		const valid = !overlapRejected && (settings.canDropEvent?.(update) ?? true);
		if (resizeIndicator !== null) {
			writeIndicatorRange(resizeIndicator, instance, range, occurrence.allDay);
			resizeIndicator.line.toggleAttribute("data-invalid", !valid);
		}
		setBodyDragging(true, !valid);
		internals.setDrag({
			kind,
			occurrence,
			proposedStart: range.start,
			proposedEnd: range.end,
			proposedAllDay: occurrence.allDay,
			proposedResourceId: occurrence.event.resourceId,
			valid,
		});
	};

	// ----- edge auto-scroll: pan the timeline while dragging near its edge -----
	const timelineViewport = viewRoot?.querySelector<HTMLElement>("[data-slot=gantt-timeline-pane] [data-slot=scroll-area-viewport]") ?? null;
	const scheduleAutoScroll = (): void => {
		if (autoScrollFrame === 0) {
			autoScrollFrame = requestAnimationFrame(autoScrollTick);
		}
	};
	function autoScrollTick(): void {
		autoScrollFrame = 0;
		if (finished || !active || surface === null || timelineViewport === null) {
			return;
		}
		const paneRect = timelineViewport.getBoundingClientRect();
		const x = lastPointer.clientX;
		let speed = 0;
		if (x < paneRect.left + AUTO_SCROLL_EDGE_PX) {
			speed = -((paneRect.left + AUTO_SCROLL_EDGE_PX - x) / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_SPEED_PX;
		} else if (x > paneRect.right - AUTO_SCROLL_EDGE_PX) {
			speed = ((x - (paneRect.right - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_SPEED_PX;
		}
		if (speed === 0) {
			return;
		}
		const before = timelineViewport.scrollLeft;
		timelineViewport.scrollLeft = before + speed;
		if (timelineViewport.scrollLeft === before) {
			return;
		}
		const axisElement = viewRoot?.querySelector<HTMLElement>(AXIS_SELECTOR) ?? null;
		if (axisElement !== null) {
			surface.axis = readAxisGeometry(axisElement);
		}
		applyProposal(lastPointer);
		positionResizeIndicator(lastPointer);
		scheduleAutoScroll();
	}

	const cleanup = (): void => {
		if (finished) {
			return;
		}
		finished = true;
		activeGestureCancels.delete(cancel);
		if (autoScrollFrame !== 0) {
			cancelAnimationFrame(autoScrollFrame);
		}
		releaseCapture(origin, pointerId);
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerCancel);
		window.removeEventListener("blur", cancel);
		window.removeEventListener("keydown", onKeyDown, true);
		if (touchTimer !== null) {
			clearTimeout(touchTimer);
		}
		// consumer-rendered overlays are React-owned: they unmount when the drag state clears
		if (config.customMoveOverlay !== true) {
			moveOverlay?.remove();
		}
		moveOverlay = null;
		resizeIndicator?.root.remove();
		resizeIndicator = null;
		setBodyDragging(false);
	};

	function cancel(): void {
		cleanup();
		if (active) {
			markGestureEnd();
			internals.setDrag(null);
			internals.setSlotDraft(null);
		}
	}

	function onKeyDown(event: KeyboardEvent): void {
		if (event.key === "Escape") {
			event.stopPropagation();
			cancel();
		}
	}

	function onPointerMove(event: PointerEvent): void {
		if (event.pointerId !== pointerId) {
			return;
		}
		lastPointer = event;
		if (!active) {
			const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
			if (isTouch) {
				// long-press pending: moving past tolerance means scroll, not drag
				if (distance > activation.touchTolerancePx) {
					cancel();
				}
				return;
			}
			if (distance < (kind === "create" ? activation.createDistancePx : activation.moveDistancePx)) {
				return;
			}
			activate();
		}
		applyProposal(event);
		positionMoveOverlay(event);
		positionResizeIndicator(event);
		scheduleAutoScroll();
	}

	function onPointerUp(event: PointerEvent): void {
		if (event.pointerId !== pointerId) {
			return;
		}
		cleanup();
		if (!active) {
			return;
		}
		markGestureEnd();
		const state = instance.getState();
		if (kind === "create") {
			const draft = state.slotDraft;
			internals.setSlotDraft(null);
			if (draft !== null) {
				api.select({ slot: { start: draft.start, end: draft.end, allDay: draft.allDay } });
				settings.onSelectSlot?.(draft);
			}
			return;
		}
		const drag = state.drag;
		internals.setDrag(null);
		if (drag === null || occurrence === undefined || overlapRejected || (settings.enforceCanDrop === true && !drag.valid)) {
			return;
		}
		if (drag.proposedStart.getTime() === occurrence.start.getTime() && drag.proposedEnd.getTime() === occurrence.end.getTime()) {
			return;
		}
		const accepted = internals.applyProposedUpdate({
			event: occurrence.event,
			occurrence,
			start: drag.proposedStart,
			end: drag.proposedEnd,
			allDay: drag.proposedAllDay,
			resourceId: drag.proposedResourceId,
			source: gestureSource(kind),
		});
		if (accepted) {
			announceGanttUpdate(ganttRoot, instance, occurrence.event.title, { start: drag.proposedStart, end: drag.proposedEnd }, drag.proposedAllDay);
		}
	}

	function onPointerCancel(event: PointerEvent): void {
		if (event.pointerId === pointerId) {
			cancel();
		}
	}

	window.addEventListener("pointermove", onPointerMove);
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("pointercancel", onPointerCancel);
	// focus loss mid-gesture means the release may never arrive: treat it as a cancel
	window.addEventListener("blur", cancel);
	window.addEventListener("keydown", onKeyDown, true);
	activeGestureCancels.add(cancel);
	capturePointer(origin, pointerId);
	if (isTouch && !active) {
		touchTimer = setTimeout((): void => {
			activate();
			applyProposal(lastPointer);
		}, activation.touchDelayMs);
	}
}

export interface GanttKeyboardGestureConfig {
	readonly instance: GanttInstance;
	readonly occurrence: GanttOccurrence;
	readonly intent: GanttKeyboardIntent;
	readonly scheduleMode?: GanttScheduleMode | undefined;
	/** The focused bar, for the live-region announcement. */
	readonly origin?: Element | null | undefined;
}

/**
 * Commits one keyboard step through the same rules as a pointer gesture:
 * the overlap policy (clamp / reject), an enforced canDropEvent veto, and the
 * onEventUpdate commit gate. Returns whether the change was accepted.
 */
export function commitKeyboardGesture(config: GanttKeyboardGestureConfig): boolean {
	const { instance, occurrence, intent } = config;
	const { settings } = instance;
	const snapMin = resolveSnapMinutes(instance.getState().scale, settings.snapDuration);
	const step = computeKeyboardStep({ intent, occurrence, snapMin, timeZone: settings.timeZone });
	if (step === null) {
		return false;
	}
	const policy = overlapPolicyFor(instance, occurrence, config.scheduleMode);
	const neighbours = policy === "allow" ? [] : collectNeighbours(instance, occurrence);
	if (policy === "reject" && overlapsNeighbours(step, neighbours)) {
		return false;
	}
	const update: GanttProposedUpdate = { event: occurrence.event, occurrence, ...step, allDay: occurrence.allDay, resourceId: occurrence.event.resourceId, source: "keyboard" };
	if (settings.enforceCanDrop === true && settings.canDropEvent?.(update) === false) {
		return false;
	}
	const accepted = instance.internals.applyProposedUpdate(update);
	if (accepted) {
		announceGanttUpdate(config.origin ?? null, instance, occurrence.event.title, step, occurrence.allDay);
	}
	return accepted;
}

export interface GanttGestures {
	readonly beginMove: (event: React.PointerEvent<HTMLElement>, segment: GanttSegment) => void;
	readonly beginResize: (event: React.PointerEvent<HTMLElement>, segment: GanttSegment, edge: "start" | "end") => void;
	readonly beginCreate: (event: React.PointerEvent<HTMLElement>) => void;
	/** Keyboard move/resize of a focused bar; returns true when the key was a gesture. */
	readonly handleKeyDown: (event: React.KeyboardEvent<HTMLElement>, segment: GanttSegment) => boolean;
	readonly canDrag: (segment: GanttSegment) => boolean;
	readonly canResize: (segment: GanttSegment) => boolean;
}

/** Can this segment's event be moved under the current interactions and its own vetoes? */
export function isSegmentDraggable(instance: GanttInstance, segment: GanttSegment): boolean {
	const event = segment.occurrence.event;
	return instance.getState().interactions.drag && event.readOnly !== true && event.draggable !== false;
}

/** Can this segment's event be resized? (a milestone has no edges) */
export function isSegmentResizable(instance: GanttInstance, segment: GanttSegment): boolean {
	const event = segment.occurrence.event;
	return (
		instance.getState().interactions.resize && event.readOnly !== true && event.resizable !== false && segment.occurrence.end.getTime() > segment.occurrence.start.getTime()
	);
}

/** Per-bar / per-row gesture wiring. */
export function useGanttGestures(): GanttGestures {
	const instance = useGantt();
	const viewConfig = useGanttViewConfig();
	const customMoveOverlay = viewConfig.renderDragPreview !== undefined;
	const customResizeOverlay = viewConfig.renderResizeIndicator !== undefined;
	const scheduleMode = viewConfig.scheduleMode;
	return React.useMemo((): GanttGestures => {
		const canDrag = (segment: GanttSegment): boolean => isSegmentDraggable(instance, segment);
		const canResize = (segment: GanttSegment): boolean => isSegmentResizable(instance, segment);
		return {
			canDrag,
			canResize,
			beginMove(event: React.PointerEvent<HTMLElement>, segment: GanttSegment): void {
				if (event.button !== PRIMARY_BUTTON || !canDrag(segment)) {
					return;
				}
				beginGesture({ instance, kind: "move", origin: event.currentTarget, startEvent: event.nativeEvent, segment, customMoveOverlay, scheduleMode });
			},
			beginResize(event: React.PointerEvent<HTMLElement>, segment: GanttSegment, edge: "start" | "end"): void {
				if (event.button !== PRIMARY_BUTTON || !canResize(segment)) {
					return;
				}
				event.stopPropagation();
				event.preventDefault();
				beginGesture({
					instance,
					kind: edge === "start" ? "resize-start" : "resize-end",
					origin: event.currentTarget,
					startEvent: event.nativeEvent,
					segment,
					customResizeOverlay,
					scheduleMode,
				});
			},
			beginCreate(event: React.PointerEvent<HTMLElement>): void {
				if (event.button !== PRIMARY_BUTTON || !instance.getState().interactions.selectSlot) {
					return;
				}
				beginGesture({ instance, kind: "create", origin: event.currentTarget, startEvent: event.nativeEvent });
			},
			handleKeyDown(event: React.KeyboardEvent<HTMLElement>, segment: GanttSegment): boolean {
				const intent = resolveKeyboardIntent({
					key: event.key,
					shiftKey: event.shiftKey,
					altKey: event.altKey,
					isRtl: getComputedStyle(event.currentTarget).direction === "rtl",
				});
				if (intent === null) {
					return false;
				}
				const allowed = intent.kind === "move" ? canDrag(segment) : canResize(segment);
				if (!allowed) {
					return false;
				}
				event.preventDefault();
				commitKeyboardGesture({ instance, occurrence: segment.occurrence, intent, scheduleMode, origin: event.currentTarget });
				return true;
			},
		};
	}, [instance, customMoveOverlay, customResizeOverlay, scheduleMode]);
}
