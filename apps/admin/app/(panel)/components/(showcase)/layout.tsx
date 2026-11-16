import { notFound } from "next/navigation";
import type * as React from "react";

import { ShowcaseSearch } from "@/components/component-showcase/showcase-search";
import { SHOWCASE_FEATURE } from "@/lib/feature-flags";
import { isFeatureEnabled } from "@/lib/server/feature-flag-settings";

/**
 * `/components` and `/components/<slug>`: the component showcase, with its search pinned on top. It is a developer tool: where it is
 * off (`ADMIN_SHOWCASE`, off in production by default, or a runtime
 * feature flag setting, enhancement 5.6) this answers 404, and its sidebar
 * item is hidden.
 */
export default async function ComponentsLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	if (!(await isFeatureEnabled(SHOWCASE_FEATURE))) {
		notFound();
	}
	return (
		// The pinned search's height, shared with what must stick below it (the docs outline): the 36px input, 12px above and
		// below it, and the 1px bottom border. `contents` adds no box, only the variable.
		<div className="contents [--showcase-search-height:calc(--spacing(15)+1px)]">
			<ShowcaseSearch />
			{children}
		</div>
	);
}
