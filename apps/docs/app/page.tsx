import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Root } from "fumadocs-core/page-tree";

import { OpenSearchButton } from "@/components/open-search-button";
import { SiteFooter } from "@/components/site-footer";
import { getBlogPosts } from "@/lib/blog";
import { SECTION_ICONS } from "@/lib/docs-tree";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { source } from "@/lib/source";

interface SectionPage {
	readonly title: string;
	readonly url: string;
	readonly description: string;
}

interface Section {
	readonly title: string;
	pages: SectionPage[];
}

/** Page-tree node names are `ReactNode`; guides only use plain strings. */
function treeTitle(name: ReactNode): string {
	return typeof name === "string" ? name : "";
}

/**
 * Rebuilds the sidebar's sections (separator → pages) straight from the page
 * tree, so the landing's quick links can never drift from `docs/meta.json`.
 */
function buildSections(tree: Root): readonly Section[] {
	const descriptions = new Map(source.getPages().map((page) => [page.url, page.data.description ?? ""]));
	const sections: Section[] = [];
	let current: Section | undefined;
	for (const node of tree.children) {
		if (node.type === "separator") {
			// Separator names come from `--- Label ---` meta entries and carry
			// surrounding whitespace — trim so section titles + icon lookups match.
			current = { title: treeTitle(node.name).trim(), pages: [] };
			sections.push(current);
		} else if (node.type === "page") {
			if (current === undefined) {
				current = { title: "Guides", pages: [] };
				sections.push(current);
			}
			current.pages.push({ title: treeTitle(node.name), url: node.url, description: descriptions.get(node.url) ?? "" });
		}
	}
	return sections.filter((section) => section.pages.length > 0);
}

const sections: readonly Section[] = buildSections(source.getPageTree());

/** Landing quick stats — computed from the real content so they never lie. */
const stats: readonly { readonly label: string; readonly value: string }[] = [
	{ label: "Guides", value: String(source.getPages().length) },
	{ label: "Sections", value: String(sections.length) },
	{ label: "Articles", value: String(getBlogPosts().length) },
];

/**
 * `/` — the landing page. A modern-dev-tool hero (Space Grotesk headline, the
 * inverted slate-800/white brand pill, a soft slate glow + dot-grid backdrop,
 * real quick stats) followed by the sidebar's sections as a card grid. The
 * footer keeps its own wrapper so it stays a separate grid child of the docs
 * layout (that placement was verified rendering correctly).
 */
export default function HomePage(): React.JSX.Element {
	return (
		<>
			<div className="flex flex-col">
				{/* ── Hero ─────────────────────────────────────────────────── */}
				<section className="border-fd-border relative overflow-hidden border-b">
					{/* Backdrops: a faint slate radial glow + fading dot grid (monochrome, no gradients-slop). */}
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_0%,var(--color-fd-accent),transparent_72%)]" />
					<div className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black_20%,transparent_78%)] opacity-60" />

					<div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-6 pt-20 pb-16 text-center sm:pt-24">
						{/* Brand pill — the inverted slate-800/white accent. */}
						<div className="bg-fd-primary text-fd-primary-foreground inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase">
							<span className="bg-fd-primary-foreground/70 size-1.5 rounded-full" />
							NestJS · Next.js · Turborepo
						</div>

						<h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
							{SITE_NAME} — build the monorepo <span className="text-fd-muted-foreground">with confidence.</span>
						</h1>

						<p className="text-fd-muted-foreground max-w-2xl text-base leading-7 text-balance sm:text-lg">{SITE_DESCRIPTION}</p>

						<div className="flex flex-wrap items-center justify-center gap-3">
							<OpenSearchButton label="Search the docs" />
							<Link
								href="/docs/getting-started"
								className="bg-fd-primary text-fd-primary-foreground inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium shadow-sm transition-opacity hover:opacity-90">
								Getting started
								<ArrowRight className="size-4" />
							</Link>
						</div>

						{/* Quick stats — real counts, slate-muted, Space Grotesk numerals. */}
						<dl className="border-fd-border mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t pt-6">
							{stats.map((stat) => (
								<div key={stat.label} className="flex items-baseline gap-2">
									<dt className="sr-only">{stat.label}</dt>
									<dd className="font-heading text-2xl font-bold tracking-tight">{stat.value}</dd>
									<span className="text-fd-muted-foreground text-xs font-medium tracking-wide uppercase">{stat.label}</span>
								</div>
							))}
						</dl>
					</div>
				</section>

				{/* ── Guide sections ────────────────────────────────────────── */}
				<div className="mx-auto w-full max-w-5xl px-6 py-14">
					<div className="space-y-12">
						{sections.map((section) => {
							const SectionIcon = SECTION_ICONS[section.title];
							return (
								<section key={section.title}>
									<div className="mb-4 flex items-center gap-3">
										{SectionIcon !== undefined ? <SectionIcon className="text-fd-muted-foreground size-4" /> : null}
										<h2 className="text-fd-foreground font-heading text-lg font-semibold tracking-tight">{section.title}</h2>
										<div className="bg-fd-border h-px flex-1" />
										<span className="text-fd-muted-foreground font-mono text-xs">{String(section.pages.length).padStart(2, "0")}</span>
									</div>
									<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
										{section.pages.map((page, index) => (
											<Link
												key={page.url}
												href={page.url}
												className="group border-fd-border bg-fd-card hover:border-fd-primary/50 hover:bg-fd-accent/50 flex flex-col gap-2.5 rounded-xl border p-4 shadow-sm transition-colors">
												<span className="text-fd-foreground flex items-center gap-2.5 font-medium">
													<span className="text-fd-muted-foreground/70 font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>
													{page.title}
													<ArrowRight className="text-fd-muted-foreground ms-auto size-3.5 transition-transform group-hover:translate-x-0.5" />
												</span>
												<span className="text-fd-muted-foreground line-clamp-2 pl-6 text-xs leading-5">{page.description}</span>
											</Link>
										))}
									</div>
								</section>
							);
						})}
					</div>
				</div>
			</div>

			{/* Footer keeps its own wrapper — a separate grid child of the docs
			    layout, so it stays at the bottom (verified placement). */}
			<div className="mt-10">
				<SiteFooter />
			</div>
		</>
	);
}
