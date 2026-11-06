// What the person has chosen to look at, and what each key does to it. Pure.
import type { KeyName } from "./keyboard.ts";

export type ViewId = "live" | "packages" | "slowest" | "problems" | "log" | "changes";

export interface ViewDefinition {
	readonly id: ViewId;
	readonly label: string;
	readonly key: KeyName;
}

export const VIEWS: readonly ViewDefinition[] = [
	{ id: "live", label: "Live", key: "view1" },
	{ id: "packages", label: "Packages", key: "view2" },
	{ id: "slowest", label: "Slowest", key: "view3" },
	{ id: "problems", label: "Problems", key: "view4" },
	{ id: "log", label: "Log", key: "view5" },
	{ id: "changes", label: "Changes", key: "view6" },
];

export interface DashboardState {
	readonly view: ViewId;
	/** The first row shown; undefined stays at the panel's natural place, which for a tail is the newest line. */
	readonly top: number | undefined;
	/** The highlighted row of the packages view. */
	readonly selected: number;
	/** Narrows the log to one package. */
	readonly logFilter: string | undefined;
	/** The first `q` asks; a run that took minutes shouldn't end on a slip of the finger. */
	readonly confirmingCancel: boolean;
}

/** What a key needs to know about the panel on screen. */
export interface PanelShape {
	readonly length: number;
	readonly tail: boolean;
	readonly height: number;
	/** The package at a row of the packages view. */
	readonly packageAt: (row: number) => string | undefined;
}

export interface KeyResult {
	readonly state: DashboardState;
	readonly cancel: boolean;
}

export const INITIAL_DASHBOARD: DashboardState = { view: "live", top: undefined, selected: 0, logFilter: undefined, confirmingCancel: false };

function clamp(value: number, low: number, high: number): number {
	return Math.min(Math.max(value, low), high);
}

function showView(state: DashboardState, view: ViewId): DashboardState {
	return { ...state, view, top: undefined };
}

function stepView(state: DashboardState, step: number): DashboardState {
	const index = VIEWS.findIndex((item) => item.id === state.view);
	const next = VIEWS.at((index + step) % VIEWS.length);
	return next === undefined ? state : showView(state, next.id);
}

function scrollTo(state: DashboardState, target: number, panel: PanelShape): DashboardState {
	const lastTop = Math.max(panel.length - panel.height, 0);
	const top = clamp(target, 0, lastTop);
	return { ...state, top: panel.tail && top === lastTop ? undefined : top };
}

function scrollBy(state: DashboardState, rows: number, panel: PanelShape): DashboardState {
	const lastTop = Math.max(panel.length - panel.height, 0);
	return scrollTo(state, (state.top ?? (panel.tail ? lastTop : 0)) + rows, panel);
}

function selectRow(state: DashboardState, row: number, panel: PanelShape): DashboardState {
	return { ...state, selected: clamp(row, 0, Math.max(panel.length - 1, 0)) };
}

function move(state: DashboardState, rows: number, panel: PanelShape): DashboardState {
	return state.view === "packages" ? selectRow(state, state.selected + rows, panel) : scrollBy(state, rows, panel);
}

function moveToEdge(state: DashboardState, target: number, panel: PanelShape): DashboardState {
	return state.view === "packages" ? selectRow(state, target, panel) : scrollTo(state, target, panel);
}

function openPackageLog(state: DashboardState, panel: PanelShape): DashboardState {
	const name = state.view === "packages" ? panel.packageAt(state.selected) : undefined;
	return name === undefined ? state : { ...showView(state, "log"), logFilter: name };
}

function goBack(state: DashboardState): DashboardState {
	return state.logFilter === undefined ? state : { ...showView(state, "packages"), logFilter: undefined };
}

function navigate(state: DashboardState, key: KeyName, panel: PanelShape): DashboardState {
	const view = VIEWS.find((item) => item.key === key);
	if (view !== undefined) {
		return showView(state, view.id);
	}
	switch (key) {
		case "next":
			return stepView(state, 1);
		case "previous":
			return stepView(state, VIEWS.length - 1);
		case "up":
			return move(state, -1, panel);
		case "down":
			return move(state, 1, panel);
		case "pageUp":
			return move(state, -panel.height, panel);
		case "pageDown":
			return move(state, panel.height, panel);
		case "home":
			return moveToEdge(state, 0, panel);
		case "end":
			return moveToEdge(state, panel.length, panel);
		case "enter":
			return openPackageLog(state, panel);
		case "escape":
			return goBack(state);
		default:
			return state;
	}
}

export function applyKey(state: DashboardState, key: KeyName, panel: PanelShape): KeyResult {
	if (key === "interrupt" || (key === "quit" && state.confirmingCancel)) {
		return { state: { ...state, confirmingCancel: false }, cancel: true };
	}
	if (key === "quit") {
		return { state: { ...state, confirmingCancel: true }, cancel: false };
	}
	return { state: navigate({ ...state, confirmingCancel: false }, key, panel), cancel: false };
}
