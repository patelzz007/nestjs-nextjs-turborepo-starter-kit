import { Link } from "@tanstack/react-router";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { Rss } from "lucide-react";
import type { ReactElement } from "react";

import type { PostSummary } from "@/lib/content";
import { formatEpochDate } from "@/lib/dates";
import { BLOG_DESCRIPTION } from "@/lib/site";

import { DocsIcon } from "./docs-icon";

export interface PostListProps {
	readonly posts: readonly PostSummary[];
}

/** The blog index: every post in `blog/meta.json` order, with its category, date and reading time. */
export function PostList({ posts }: PostListProps): ReactElement {
	return (
		<main id="main-content" className="mx-auto max-w-10xl px-4 pt-10 pb-20 md:px-6">
			<header className="grid max-w-3xl gap-3">
				<p className="font-mono text-xs text-muted-foreground">blog/</p>
				<h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Engineering Blog</h1>
				<p className="text-lg leading-relaxed text-(--docs-text-secondary)">
					{BLOG_DESCRIPTION}{" "}
					<a
						href="/feed.xml"
						className="inline-flex items-center gap-1 text-(--docs-link) underline decoration-(--docs-link-line) underline-offset-4 hover:decoration-(--docs-link)">
						<Rss aria-hidden="true" className="size-4" />
						Subscribe with RSS
					</a>
				</p>
			</header>
			{posts.length === 0 ? (
				<p className="mt-10 text-muted-foreground">No posts yet. Add a Markdown file to the repo-root `blog/` folder.</p>
			) : (
				<ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{posts.map((post) => (
						<li key={post.id}>
							<article className="relative flex h-full gap-3 rounded-lg border border-border bg-(--docs-chrome) p-4 transition-colors focus-within:border-(--docs-link) hover:border-(--docs-link)">
								<IconTile variant="soft" tone="neutral" size="md" className="shrink-0">
									<DocsIcon name="newspaper" size={18} className="text-(--docs-link)" />
								</IconTile>
								<div className="grid min-w-0 content-start gap-1">
									<p className="font-mono text-xs text-(--docs-link)">{post.category.toLowerCase()}</p>
									<h2 className="text-lg leading-snug font-semibold text-balance">
										<Link to="/blog/$" params={{ _splat: post.id }} className="after:absolute after:inset-0 focus-visible:outline-none">
											{post.title}
										</Link>
									</h2>
									<p className="text-sm text-(--docs-text-secondary)">{post.description}</p>
									<p className="mt-2 text-xs text-muted-foreground tabular-nums">
										<time dateTime={new Date(post.date).toISOString()}>{formatEpochDate(post.date)}</time> · {post.author} · {post.readingMinutes} min read
									</p>
								</div>
							</article>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
