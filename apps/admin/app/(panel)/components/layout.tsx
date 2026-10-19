import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type * as React from "react";

import { readComponentsNavOpen } from "@/components/component-gallery/gallery-nav-cookie";
import { GalleryShell } from "@/components/component-gallery/gallery-shell";
import { serverEnv } from "@/lib/env/env.server";
import { isComponentGalleryEnabled } from "@/lib/feature-flags";

/**
 * `/components/*`: the gallery's side navigation beside the page — the
 * overview or one component's page. Its open state is read from its own
 * cookie, so a collapsed list stays collapsed on the next load. The gallery is
 * a developer tool: a deployment that has not enabled it (`ADMIN_COMPONENT_GALLERY`,
 * off in production by default) answers 404 here, and its sidebar item is hidden.
 */
export default async function ComponentsLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	if (!isComponentGalleryEnabled(serverEnv)) {
		notFound();
	}
	return <GalleryShell initialNavOpen={readComponentsNavOpen(await cookies())}>{children}</GalleryShell>;
}
