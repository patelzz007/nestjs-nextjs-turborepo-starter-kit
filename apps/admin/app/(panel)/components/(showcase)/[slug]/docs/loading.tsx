import type * as React from "react";

import { ShowcaseDocsPageSkeleton } from "@/components/loading/showcase-skeleton";

/** `/components/<slug>/docs` while it streams in — mirrors `ShowcaseDocsPage`. */
export default function Loading(): React.JSX.Element {
	return <ShowcaseDocsPageSkeleton />;
}
