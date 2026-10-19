import type { CascadePreviewInput, GeoImportInput } from "@workspace/shared";

/** Every level of the geography hierarchy, top-down: region ⊃ subregion ⊃ country ⊃ state ⊃ city. */
export type GeoEntityKind = GeoImportInput["entity"];

/** A level that has children — what a cascade delete or a cascade preview starts from. */
export type GeoParentKind = CascadePreviewInput["entity"];

/** The levels, top-down. */
export const GEO_ENTITY_KINDS: readonly GeoEntityKind[] = ["region", "subregion", "country", "state", "city"];

/** How each level is named in a client-facing message ("Region #4 not found"). */
export const GEO_ENTITY_LABEL: Readonly<Record<GeoEntityKind, string>> = {
	region: "Region",
	subregion: "Subregion",
	country: "Country",
	state: "State",
	city: "City",
};
