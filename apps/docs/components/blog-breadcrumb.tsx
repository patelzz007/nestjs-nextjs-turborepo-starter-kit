import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Blog article breadcrumb — `Home / Blog / <post>`. The guides' breadcrumb is
 * rendered by Fumadocs' `DocsPage` from the docs page tree, but blog posts
 * live in a separate loader (`/blog`), so they resolve to nothing in that
 * tree. This hand-rolled trail mirrors the Fumadocs styling exactly
 * (`text-fd-muted-foreground` + ChevronRight separators + a highlighted
 * current page) so the two feel identical.
 */
export function BlogBreadcrumb({ title }: { readonly title: string }): React.JSX.Element {
	return (
		<nav aria-label="Breadcrumb" className="text-fd-muted-foreground mb-6 flex items-center gap-1.5 text-sm">
			<Link href="/" className="transition-opacity hover:opacity-80">
				Home
			</Link>
			<ChevronRight className="size-3.5 shrink-0" />
			<Link href="/blog" className="transition-opacity hover:opacity-80">
				Blog
			</Link>
			<ChevronRight className="size-3.5 shrink-0" />
			<span className="text-fd-primary truncate font-medium">{title}</span>
		</nav>
	);
}
