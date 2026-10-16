// The Components screen's families: the kit's components grouped as the web's
// Components page groups them, one family shown at a time so the screen stays
// light to render.

export type GalleryFamily = "inputs" | "selection" | "overlays" | "display" | "data" | "dates" | "media";

export interface GalleryFamilyOption {
	readonly value: GalleryFamily;
	readonly label: string;
}

export const GALLERY_FAMILIES: readonly GalleryFamilyOption[] = [
	{ value: "inputs", label: "Inputs" },
	{ value: "selection", label: "Selection" },
	{ value: "overlays", label: "Overlays" },
	{ value: "display", label: "Feedback" },
	{ value: "data", label: "Data" },
	{ value: "dates", label: "Dates" },
	{ value: "media", label: "Media" },
];

export const DEFAULT_GALLERY_FAMILY: GalleryFamily = "inputs";

/** The family a chip press leaves selected: a chip cannot be pressed off, so `null` keeps the current one. */
export function nextGalleryFamily(current: GalleryFamily, pressed: GalleryFamily | null): GalleryFamily {
	return pressed ?? current;
}
