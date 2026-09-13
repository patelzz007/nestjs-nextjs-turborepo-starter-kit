import type { Metadata } from "next";

import { DocsIndexLanding } from "@/components/docs-index-landing";
import { buildDocsSections } from "@/lib/docs-sections";
import { getDocsTree } from "@/lib/docs-tree";
import { BASE_URL, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
	title: "Guides",
	description: SITE_DESCRIPTION,
	openGraph: {
		title: `Guides — ${SITE_NAME}`,
		description: SITE_DESCRIPTION,
		type: "website",
		url: `${BASE_URL}/docs`,
	},
};

/** `/docs` — documentation hub with search, featured guides, and the full catalog. */
export default function DocsIndexPage(): React.JSX.Element {
	const sections = buildDocsSections(getDocsTree());
	return <DocsIndexLanding sections={sections} />;
}
