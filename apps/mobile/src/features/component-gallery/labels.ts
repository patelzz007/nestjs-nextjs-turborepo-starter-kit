/** The gallery's copy. Kept apart from the gallery body so the route can show it while the body loads (the body is development-only). */
export const COMPONENT_GALLERY_COPY = {
	description: "Every component of the mobile UI kit, live. Pick a family to see its components in each variant, size and state.",
	loading: "Loading the component gallery",
} satisfies Record<string, string>;
