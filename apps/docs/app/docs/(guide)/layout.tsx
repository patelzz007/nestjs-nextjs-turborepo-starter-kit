import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { docsSidebarComponents } from "@/components/docs-sidebar-components";
import { getDocsTree } from "@/lib/docs-tree";
import { baseOptions } from "@/lib/layout.shared";

/** Guide pages (`/docs/*`) — docs sidebar from `docs/meta.json`. */
export default function DocsGuideLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
	return (
		<DocsLayout {...baseOptions()} tree={getDocsTree()} sidebar={{ components: docsSidebarComponents }}>
			{children}
		</DocsLayout>
	);
}
