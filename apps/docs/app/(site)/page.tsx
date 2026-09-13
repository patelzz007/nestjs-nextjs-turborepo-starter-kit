import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { OpenSearchButton } from "@/components/open-search-button";
import { SiteFooter } from "@/components/site-footer";
import { buildDocsSections, DOCS_LANDING_STATS } from "@/lib/docs-sections";
import { getDocsTree, SECTION_ICONS } from "@/lib/docs-tree";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

const sections = buildDocsSections(getDocsTree());

/**
 * `/` — marketing landing. The full documentation hub lives at `/docs`.
 */
export default function HomePage(): React.JSX.Element {
	return (
		<>
			<div className="flex flex-col">
				<section className="border-fd-border relative overflow-hidden border-b">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_0%,var(--color-fd-accent),transparent_72%)]" />
					<div className="bg-dot-grid [mask-[radial-gradient(ellipse_75%_65%_at_50%_0%,black_20%,transparent_78%)]] pointer-events-none absolute inset-0 opacity-60" />

					<div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-6 pt-20 pb-16 text-center sm:pt-24">
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
								href="/docs"
								className="bg-fd-primary text-fd-primary-foreground inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium shadow-sm transition-opacity hover:opacity-90">
								Browse guides
								<ArrowRight className="size-4" />
							</Link>
						</div>

						<dl className="border-fd-border mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t pt-6">
							{DOCS_LANDING_STATS.map((stat) => (
								<div key={stat.label} className="flex items-baseline gap-2">
									<dt className="sr-only">{stat.label}</dt>
									<dd className="font-heading text-2xl font-bold tracking-tight">{stat.value}</dd>
									<span className="text-fd-muted-foreground text-xs font-medium tracking-wide uppercase">{stat.label}</span>
								</div>
							))}
						</dl>
					</div>
				</section>

				<div className="mx-auto w-full max-w-5xl px-6 py-14">
					<div className="mb-8 flex flex-wrap items-end justify-between gap-3">
						<h2 className="font-heading text-xl font-semibold tracking-tight">Explore the docs</h2>
						<Link href="/docs" className="text-fd-muted-foreground hover:text-fd-foreground text-sm font-medium transition-colors">
							View all guides →
						</Link>
					</div>
					<div className="space-y-12">
						{sections.slice(0, 2).map((section) => {
							const SectionIcon = SECTION_ICONS[section.title];
							return (
								<section key={section.title}>
									<div className="mb-4 flex items-center gap-3">
										{SectionIcon !== undefined ? <SectionIcon className="text-fd-muted-foreground size-4" /> : null}
										<h3 className="text-fd-foreground font-heading text-lg font-semibold tracking-tight">{section.title}</h3>
										<div className="bg-fd-border h-px flex-1" />
									</div>
									<div className="grid gap-4 sm:grid-cols-2">
										{section.pages.slice(0, 4).map((page) => (
											<Link
												key={page.url}
												href={page.url}
												className="group border-fd-border bg-fd-card hover:border-fd-primary/40 hover:bg-fd-muted flex flex-col gap-2 rounded-xl border p-4 shadow-sm transition-colors">
												<span className="text-fd-foreground font-medium">{page.title}</span>
												<span className="text-fd-muted-foreground line-clamp-2 text-xs leading-5">{page.description}</span>
											</Link>
										))}
									</div>
								</section>
							);
						})}
					</div>
				</div>
			</div>

			<div className="mt-10">
				<SiteFooter />
			</div>
		</>
	);
}
