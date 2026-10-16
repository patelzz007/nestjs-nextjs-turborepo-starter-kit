import { cookies } from "next/headers";
import type * as React from "react";

import { readComponentsNavOpen } from "@/components/component-gallery/gallery-nav-cookie";
import { GalleryShell } from "@/components/component-gallery/gallery-shell";

/**
 * `/components/*`: the gallery's side navigation beside the page — the
 * overview or one component's page. Its open state is read from its own
 * cookie, so a collapsed list stays collapsed on the next load.
 */
export default async function ComponentsLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	return <GalleryShell initialNavOpen={readComponentsNavOpen(await cookies())}>{children}</GalleryShell>;
}
