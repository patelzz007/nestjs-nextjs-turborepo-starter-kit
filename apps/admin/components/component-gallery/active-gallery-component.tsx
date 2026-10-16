"use client";

import * as React from "react";

/**
 * Which component a gallery page shows. Each family module (`*-family.tsx`)
 * renders the sections of all its components; on `/components/<slug>` this
 * names the one section to keep, so a page mounts a single component's demos
 * and examples instead of a whole family's. Without a provider (a family
 * rendered on its own, as its tests do) every section is shown.
 */
const ActiveGalleryComponentContext = React.createContext<string | null>(null);

export interface ActiveGalleryComponentProviderProps {
	/** The section id (`GalleryEntry.id`) of the component to show. */
	readonly sectionId: string;
	readonly children: React.ReactNode;
}

export function ActiveGalleryComponentProvider({ sectionId, children }: ActiveGalleryComponentProviderProps): React.JSX.Element {
	return <ActiveGalleryComponentContext.Provider value={sectionId}>{children}</ActiveGalleryComponentContext.Provider>;
}

/** Whether the section `sectionId` is shown: always without a provider, otherwise only the active one. */
export function useIsGallerySectionShown(sectionId: string): boolean {
	const active = React.useContext(ActiveGalleryComponentContext);
	return active === null || active === sectionId;
}
