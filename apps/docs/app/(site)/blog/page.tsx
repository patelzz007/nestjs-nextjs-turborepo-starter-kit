import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRight, CalendarDays, Clock, User } from "lucide-react";

import { getBlogPosts } from "@/lib/blog";
import { formatEpochDate } from "@/lib/dates";
import { getReadingTime } from "@/lib/page-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
	title: "Blog",
	description: "Articles on building the monorepo — architecture, engineering, tooling and integrations.",
};

/**
 * Category → card accent (chip + header band). Monochrome by design — the
 * inverted slate-800/white pill is the brand accent; the tinted band uses the
 * layout's slate tokens so cards read as part of the docs, not a separate
 * colorful blog.
 */
const CATEGORY_CHIP = "bg-fd-primary text-fd-primary-foreground";
const CATEGORY_BAND = "from-fd-muted to-fd-muted/40";

function categoryStyle(_category: string): { readonly chip: string; readonly band: string } {
	return { chip: CATEGORY_CHIP, band: CATEGORY_BAND };
}

/**
 * `/blog` — the article index. RunCloud-style: a quiet hero header plus a
 * responsive grid of post cards (category chip, title, description, then
 * author · date · reading time). Newest first.
 */
export default function BlogIndexPage(): React.JSX.Element {
	const posts = getBlogPosts();

	return (
		<main className="mx-auto w-full max-w-5xl px-6 pt-12 pb-24 md:px-10">
			{/* Hero */}
			<header className="mb-12">
				<p className="text-fd-primary mb-3 text-sm font-medium tracking-wide uppercase">The {SITE_NAME} Blog</p>
				<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Articles on building the monorepo</h1>
				<p className="mt-3 max-w-2xl text-balance text-muted-foreground">
					Architecture decisions, engineering deep-dives, tooling notes and integration write-ups — straight from the team that ships it.
				</p>
			</header>

			{/* Card grid */}
			{posts.length > 0 ? (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{posts.map((post) => {
						const style = categoryStyle(post.data.category);
						const readingMinutes = getReadingTime(post.data.structuredData, post.data.description);
						return (
							<Link
								key={post.url}
								href={post.url}
								className="group border-fd-border bg-fd-card hover:border-fd-primary/50 flex flex-col overflow-hidden rounded-2xl border shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
								{/* Visual band — monochrome slate, no external images needed */}
								<div className={`bg-linear-to-br ${style.band} bg-fd-muted/40 flex h-28 items-start justify-between p-4`}>
									<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.chip}`}>{post.data.category}</span>
								</div>

								<div className="flex flex-1 flex-col gap-3 p-5">
									<h2 className="group-hover:text-fd-primary text-base leading-snug font-semibold tracking-tight">{post.data.title}</h2>
									<p className="text-fd-muted-foreground line-clamp-3 flex-1 text-sm leading-relaxed">{post.data.description}</p>

									<div className="border-fd-border text-fd-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-xs">
										<span className="inline-flex items-center gap-1.5">
											<User className="size-3.5" />
											{post.data.author}
										</span>
										<span className="inline-flex items-center gap-1.5">
											<CalendarDays className="size-3.5" />
											{formatEpochDate(post.data.date)}
										</span>
										<span className="inline-flex items-center gap-1.5">
											<Clock className="size-3.5" />
											{readingMinutes} min read
										</span>
										<ArrowRight className="ms-auto size-3.5 transition-transform group-hover:translate-x-0.5" />
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			) : (
				<div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
					No articles yet — add markdown files to <code className="font-mono">blog/</code> and they'll appear here.
				</div>
			)}
		</main>
	);
}
