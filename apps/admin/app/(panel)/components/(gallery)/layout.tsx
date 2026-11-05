import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type * as React from "react";

import { readComponentsNavOpen } from "@/components/component-gallery/gallery-nav-cookie";
import { GalleryShell } from "@/components/component-gallery/gallery-shell";
import { COMPONENT_GALLERY_FEATURE } from "@/lib/feature-flags";
import { isFeatureEnabled } from "@/lib/server/feature-flag-settings";

/**
 * `/components/*`: the gallery's side navigation beside the page — the
 * overview or one component's page. Its open state is read from its own
 * cookie, so a collapsed list stays collapsed on the next load. The gallery is
 * a developer tool: where it is off (`ADMIN_COMPONENT_GALLERY`, off in production by default, or a runtime
 * feature flag setting, enhancement 5.6) this answers 404, and its sidebar item is hidden.
 */
export default async function ComponentsLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	if (!(await isFeatureEnabled(COMPONENT_GALLERY_FEATURE))) {
		notFound();
	}
	return <GalleryShell initialNavOpen={readComponentsNavOpen(await cookies())}>{children}</GalleryShell>;
}
