import { ArrowRight, BookOpen, ExternalLink, FileCode2, Layers, Rocket, Search } from "lucide-react";
import Link from "next/link";

import { OpenSearchButton } from "@/components/open-search-button";
import { SiteFooter } from "@/components/site-footer";
import { DOCS_LANDING_STATS, FEATURED_GUIDES, type DocsSection } from "@/lib/docs-sections";
import { SECTION_ICONS } from "@/lib/docs-tree";
import { GITHUB_URL, SITE_DESCRIPTION } from "@/lib/site";

const FEATURED_ICONS = [Rocket, Layers, BookOpen, FileCode2] as const;

export interface DocsIndexLandingProps {
	readonly sections: readonly DocsSection[];
}

/**
 * `/docs` hub — documentation landing with search-first hero, featured
 * entry points, and the full guide catalog grouped by sidebar sections.
 */
export function DocsIndexLanding({ sections }: DocsIndexLandingProps): React.JSX.Element {
	return (
		<>
			<div className="flex flex-col">
				<section className="border-fd-border docs-index-hero relative overflow-hidden border-b">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_0%,hsl(142_71%_45%/0.12),transparent_70%)]" />
					<div className="bg-dot-grid pointer-events-none absolute inset-0 mask-[linear-gradient(to_bottom,black,transparent_88%)] opacity-40" />

					<div className="relative mx-auto grid w-full max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:py-16">
						<div className="space-y-6">
							<div className="border-fd-border bg-fd-card text-fd-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase">
								<span className="bg-fd-docs-cta size-1.5 rounded-full" aria-hidden="true" />
								Developer documentation
							</div>

							<div className="space-y-4">
								<h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl">Everything you need to ship in the monorepo.</h1>
								<p className="text-fd-muted-foreground max-w-xl text-base leading-7 sm:text-lg">{SITE_DESCRIPTION}</p>
							</div>

							<div className="flex flex-wrap items-center gap-3">
								<OpenSearchButton label="Search guides" />
								<Link
									href="/docs/getting-started"
									className="bg-fd-docs-cta text-fd-docs-cta-foreground inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-[opacity,transform] duration-200 hover:opacity-90 motion-reduce:transition-none">
									Start here
									<ArrowRight className="size-4" aria-hidden="true" />
								</Link>
							</div>

							<dl className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
								{DOCS_LANDING_STATS.map((stat) => (
									<div key={stat.label} className="flex items-baseline gap-2">
										<dt className="sr-only">{stat.label}</dt>
										<dd className="font-heading text-2xl font-bold tracking-tight">{stat.value}</dd>
										<span className="text-fd-muted-foreground text-xs font-medium tracking-wide uppercase">{stat.label}</span>
									</div>
								))}
							</dl>
						</div>

						<div className="border-fd-border bg-fd-card/80 space-y-3 rounded-2xl border p-4 shadow-sm backdrop-blur-sm sm:p-5">
							<div className="flex items-center gap-2 text-sm font-medium">
								<Search className="text-fd-docs-cta size-4" aria-hidden="true" />
								Popular starting points
							</div>
							<ul className="space-y-2">
								{FEATURED_GUIDES.map((guide, index) => {
									const Icon = FEATURED_ICONS[index] ?? BookOpen;
									return (
										<li key={guide.href}>
											<Link
												href={guide.href}
												className="group border-fd-border bg-fd-background hover:border-fd-docs-cta/40 hover:bg-fd-muted flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors duration-200 motion-reduce:transition-none">
												<span className="bg-fd-muted text-fd-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
													<Icon className="size-4" aria-hidden="true" />
												</span>
												<span className="min-w-0 flex-1">
													<span className="text-fd-foreground block font-medium">{guide.title}</span>
													<span className="text-fd-muted-foreground block truncate text-xs">{guide.hint}</span>
												</span>
												<ArrowRight
													className="text-fd-muted-foreground size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
													aria-hidden="true"
												/>
											</Link>
										</li>
									);
								})}
							</ul>
						</div>
					</div>
				</section>

				<div className="mx-auto w-full max-w-7xl px-6 py-12 lg:py-14">
					<div className="mb-10 flex flex-wrap items-end justify-between gap-4">
						<div>
							<h2 className="font-heading text-2xl font-semibold tracking-tight">Browse by topic</h2>
							<p className="text-fd-muted-foreground mt-1 text-sm">Mirrors the sidebar — pick a section and jump in.</p>
						</div>
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noreferrer noopener"
							className="text-fd-muted-foreground hover:text-fd-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors">
							<ExternalLink className="size-4" aria-hidden="true" />
							Edit on GitHub
						</a>
					</div>

					<div className="space-y-12">
						{sections.map((section) => {
							const SectionIcon = SECTION_ICONS[section.title];
							return (
								<section key={section.title} aria-labelledby={`section-${section.title.replace(/\s+/g, "-").toLowerCase()}`}>
									<div className="mb-4 flex items-center gap-3">
										{SectionIcon !== undefined ? <SectionIcon className="text-fd-docs-cta size-4" aria-hidden="true" /> : null}
										<h2 id={`section-${section.title.replace(/\s+/g, "-").toLowerCase()}`} className="font-heading text-lg font-semibold tracking-tight">
											{section.title}
										</h2>
										<div className="bg-fd-border h-px flex-1" />
										<span className="text-fd-muted-foreground font-mono text-xs">{String(section.pages.length).padStart(2, "0")}</span>
									</div>
									<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
										{section.pages.map((page, index) => (
											<Link
												key={page.url}
												href={page.url}
												className="group border-fd-border bg-fd-card hover:border-fd-docs-cta/35 hover:bg-fd-muted flex flex-col gap-2 rounded-xl border p-4 shadow-sm transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none">
												<span className="text-fd-foreground flex items-start gap-2.5 leading-snug font-medium">
													<span className="text-fd-muted-foreground font-mono text-xs tabular-nums">{String(index + 1).padStart(2, "0")}</span>
													<span className="min-w-0 flex-1">{page.title}</span>
													<ArrowRight
														className="text-fd-muted-foreground mt-0.5 size-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
														aria-hidden="true"
													/>
												</span>
												{page.description.length > 0 ? <span className="text-fd-muted-foreground line-clamp-2 pl-7 text-xs leading-5">{page.description}</span> : null}
											</Link>
										))}
									</div>
								</section>
							);
						})}
					</div>
				</div>
			</div>

			<div className="mt-6">
				<SiteFooter />
			</div>
		</>
	);
}
