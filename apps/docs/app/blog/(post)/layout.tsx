import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { docsSidebarComponents } from "@/components/docs-sidebar-components";
import { getBlogTree } from "@/lib/blog-tree";
import { baseOptions } from "@/lib/layout.shared";

/** Article pages (`/blog/*`) — blog sidebar from `blog/meta.json`. */
export default function BlogPostLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
	return (
		<DocsLayout {...baseOptions()} tree={getBlogTree()} sidebar={{ components: docsSidebarComponents }}>
			{children}
		</DocsLayout>
	);
}
