// The surface a field sits on, so a field takes that surface's own fill (owner, 2026-11-15): an input
// inside a card is the card's colour, one in a dialog or a sheet is the popover's, and one straight on
// the page is the page's. The field's border (`border-input`) is what marks it out, never a second fill.
//
// A surface that can hold fields (`Card`, `ListGroup`, `Dialog`, `BottomSheet`, or an app's own
// `bg-card` box) wraps its content in `FieldSurfaceProvider`; anywhere else is the page.

import * as React from "react";

/** The surfaces a field can sit on, by the colour token each one is drawn in. */
export type FieldSurface = "page" | "card" | "popover";

/** Each surface's fill, as a field takes it (static class names, so Tailwind sees them). */
export const FIELD_SURFACE_FILL: Readonly<Record<FieldSurface, string>> = {
	page: "bg-background",
	card: "bg-card",
	popover: "bg-popover",
};

/** Outside any surface, a field is on the page. */
const DEFAULT_FIELD_SURFACE: FieldSurface = "page";

const FieldSurfaceContext = React.createContext<FieldSurface>(DEFAULT_FIELD_SURFACE);
FieldSurfaceContext.displayName = "FieldSurface";

export interface FieldSurfaceProviderProps {
	readonly surface: FieldSurface;
	readonly children: React.ReactNode;
}

/** Declares the surface its children sit on; the fields inside take its fill. */
export function FieldSurfaceProvider({ surface, children }: FieldSurfaceProviderProps): React.JSX.Element {
	return React.createElement(FieldSurfaceContext.Provider, { value: surface }, children);
}

/** The surface the calling field sits on. */
export function useFieldSurface(): FieldSurface {
	return React.useContext(FieldSurfaceContext);
}
