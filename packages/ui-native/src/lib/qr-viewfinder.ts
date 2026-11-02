// The camera scanner's viewfinder: where the window sits on the screen, and what the line under it
// says. Pure, so the layout and the wording are tested without a camera.
//
//   ┌──────────── screen ────────────┐
//   │  ░░░░░░░░░░ scrim ░░░░░░░░░░░  │
//   │  ░░░ ╭──            ──╮ ░░░░░  │  the window: a rounded square cut out of the scrim,
//   │  ░░░ │                │ ░░░░░  │  centred across, its middle at 42% of the height,
//   │  ░░░ ╰──            ──╯ ░░░░░  │  68% of the shorter side (220–300 pt)
//   │  ░░░░░ ( status line ) ░░░░░░  │
//   └────────────────────────────────┘

/** The window's side never drops below this (a small phone in landscape still frames a code). */
export const VIEWFINDER_MIN_SIDE = 220;

/** …nor grows past this (a tablet frames a code at arm's length, not a wall). */
export const VIEWFINDER_MAX_SIDE = 300;

/** The window's side as a share of the screen's shorter side. */
export const VIEWFINDER_SIDE_FRACTION = 0.68;

/** Where the window's middle sits, as a share of the screen's height: a little above centre, clear of the dock. */
export const VIEWFINDER_CENTER_FRACTION = 0.42;

/** The window's corner radius (the kit's `rounded-3xl`, which the corner brackets use too). */
export const VIEWFINDER_RADIUS = 24;

/** No code read this long after the camera started: the line under the window offers a tip. */
export const SLOW_SCAN_AFTER_MS = 8000;

/** How long the locked window shows before the code is handed over, so the person sees it was read. */
export const LOCK_HOLD_MS = 450;

/** Where the window sits, in points from the screen's top-left, and the scrim border that cuts it out. */
export interface ViewfinderLayout {
	readonly side: number;
	readonly left: number;
	readonly top: number;
	/**
	 * The cut-out is a view of the window's size plus this border on every side, drawn in the scrim colour
	 * with a radius of `VIEWFINDER_RADIUS + cutoutBorder`: its hole is the rounded window. As wide as the
	 * screen's longer side, so the border covers the screen from any window position.
	 */
	readonly cutoutBorder: number;
}

/** The window for a screen of `width` × `height` points. */
export function viewfinderLayout(width: number, height: number): ViewfinderLayout {
	const side = Math.round(Math.min(VIEWFINDER_MAX_SIDE, Math.max(VIEWFINDER_MIN_SIDE, Math.min(width, height) * VIEWFINDER_SIDE_FRACTION)));
	return {
		side,
		left: Math.round((width - side) / 2),
		top: Math.max(0, Math.round(height * VIEWFINDER_CENTER_FRACTION - side / 2)),
		cutoutBorder: Math.ceil(Math.max(width, height)),
	};
}

/**
 * Where a scan is. `starting`: the camera is opening. `searching`: it is live, looking for a code.
 * `slow`: still looking after `SLOW_SCAN_AFTER_MS`. `locked`: a code was read. `failed`: the camera
 * could not start.
 */
export type ScanPhase = "starting" | "searching" | "slow" | "locked" | "failed";

/** The words the line under the window can show. */
export interface ScanStatusLabels {
	readonly startingCamera: string;
	readonly hint: string;
	readonly slowHint: string;
	readonly found: string;
	readonly cameraFailed: string;
}

/** The line under the window: what the scanner is doing, or — once a photo was tried — what came of it. */
export function scanStatusOf(phase: ScanPhase, labels: ScanStatusLabels, galleryMessage: string | null): string {
	if (galleryMessage !== null && phase !== "locked") {
		return galleryMessage;
	}
	switch (phase) {
		case "starting":
			return labels.startingCamera;
		case "searching":
			return labels.hint;
		case "slow":
			return labels.slowHint;
		case "locked":
			return labels.found;
		case "failed":
			return labels.cameraFailed;
	}
}
