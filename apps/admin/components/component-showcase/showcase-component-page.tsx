import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CircleCheck, CircleX, Info } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { Markdown } from "@/components/docs/markdown";
import { SHOWCASE_FEATURE_INDEX, SHOWCASE_FEATURE_PARTS } from "@/components/component-showcase/generated/feature-index";
import { showcaseNeighbours, type ShowcaseCatalogItem } from "@/components/component-showcase/showcase-catalog";
import type { ShowcaseFaqEntry, ShowcaseOverview } from "@/components/component-showcase/showcase-content";
import type { ShowcaseFeatureSummary, ShowcasePart } from "@/components/component-showcase/showcase-feature";
import { SHOWCASE_FAMILY_META } from "@/components/component-showcase/showcase-family-meta";
import { ShowcaseFaqAccordion, type ShowcaseFaqItem } from "@/components/component-showcase/showcase-faq-accordion";
import { ShowcaseFeatures } from "@/components/component-showcase/showcase-features";
import { featureCountLabel } from "@/components/component-showcase/showcase-page";
import { SHOWCASE_ROUTES } from "@/components/component-showcase/showcase-routes";

/** ReUI's plans page: the components here are adapted from ReUI, whose Pro blocks build on them. */
const REUI_PRICING_URL = "https://reui.io/pricing";

interface NeighbourLinkProps {
	readonly item: ShowcaseCatalogItem;
	readonly direction: "previous" | "next";
}

function NeighbourLink({ item, direction }: NeighbourLinkProps): React.JSX.Element {
	const isNext = direction === "next";
	return (
		<Link
			href={SHOWCASE_ROUTES.component(item.entry.slug)}
			rel={isNext ? "next" : "prev"}
			className={`group/neighbour flex flex-1 flex-col gap-1 rounded-xl border bg-card p-4 text-card-foreground transition-colors outline-none hover:border-foreground/20 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${isNext ? "items-end text-end" : "items-start"}`}>
			<span className="flex items-center gap-1 text-xs text-muted-foreground">
				{isNext ? null : <ArrowLeft aria-hidden="true" className="size-3.5" />}
				{isNext ? "Next" : "Previous"}
				{isNext ? <ArrowRight aria-hidden="true" className="size-3.5" /> : null}
			</span>
			<span className="font-mono text-sm font-semibold text-foreground group-hover/neighbour:text-primary">{item.entry.name}</span>
		</Link>
	);
}

/** A bullet list of inline Markdown items. */
function markdownList(items: readonly string[]): string {
	return items.map((item: string): string => `- ${item}`).join("\n");
}

interface GuidancePanelProps {
	readonly title: string;
	readonly icon: React.ReactNode;
	readonly items: readonly string[];
}

function GuidancePanel({ title, icon, items }: GuidancePanelProps): React.JSX.Element {
	return (
		<section aria-label={title} className="flex flex-col gap-1 rounded-xl border bg-card p-5 text-card-foreground">
			<h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
				{icon}
				{title}
			</h2>
			<div className="text-sm">
				<Markdown source={markdownList(items)} />
			</div>
		</section>
	);
}

/** When to reach for the component, when not to, and what to know first. */
function Guidance({ overview }: { readonly overview: ShowcaseOverview }): React.JSX.Element {
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<GuidancePanel title="When to use" icon={<CircleCheck aria-hidden="true" className="size-4 text-success" />} items={overview.whenToUse} />
			<GuidancePanel title="When not to use" icon={<CircleX aria-hidden="true" className="size-4 text-destructive" />} items={overview.whenNotToUse} />
			{overview.notes.length === 0 ? null : (
				<div className="lg:col-span-2">
					<GuidancePanel title="Notes" icon={<Info aria-hidden="true" className="size-4 text-info" />} items={overview.notes} />
				</div>
			)}
		</div>
	);
}

function FrequentlyAskedQuestions({ faq }: { readonly faq: readonly ShowcaseFaqEntry[] }): React.JSX.Element {
	return (
		<section aria-labelledby="showcase-faq-title" className="flex flex-col gap-4">
			<h2 id="showcase-faq-title" className="font-heading text-2xl font-semibold tracking-tight">
				Frequently asked questions
			</h2>
			<ShowcaseFaqAccordion items={faq.map(({ question, answer }: ShowcaseFaqEntry): ShowcaseFaqItem => ({ question, answer: <Markdown source={answer} /> }))} />
		</section>
	);
}

/** The closing call to action: the components here are adapted from ReUI. */
function ReuiProCallToAction(): React.JSX.Element {
	return (
		<aside aria-label="ReUI Pro" className="flex flex-col items-start gap-3 rounded-xl border bg-muted/40 p-6 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex flex-col gap-1">
				<p className="font-semibold text-foreground">Start building with ReUI Pro today.</p>
				<p className="text-sm text-muted-foreground">These components are adapted from ReUI, whose Pro blocks compose them into complete pages.</p>
			</div>
			<a href={REUI_PRICING_URL} target="_blank" rel="noreferrer noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
				See ReUI pricing
				<ArrowUpRight aria-hidden="true" />
			</a>
		</aside>
	);
}

interface PartNavProps {
	readonly slug: string;
	readonly name: string;
	readonly parts: readonly ShowcasePart[];
	/** The part shown, or `null` on the component's own page, which shows every example. */
	readonly current: ShowcasePart | null;
}

/** The tab for the component's own page: every example, before the tabs for one group each. */
const ALL_EXAMPLES_LABEL = "All examples";

/**
 * The groups of a grouped page, as tabs that are links: "All examples" (the component's own page) and then one route
 * per group, for reading or linking to just that group.
 */
function PartNav({ slug, name, parts, current }: PartNavProps): React.JSX.Element {
	return (
		<nav aria-label={`${name} example groups`} data-showcase-parts="">
			<ul className="flex flex-wrap gap-1.5 border-b pb-3">
				<li>
					<Link
						href={SHOWCASE_ROUTES.component(slug)}
						aria-current={current === null ? "page" : undefined}
						className={buttonVariants({ variant: current === null ? "secondary" : "ghost", size: "sm" })}>
						{ALL_EXAMPLES_LABEL}
					</Link>
				</li>
				{parts.map((part: ShowcasePart): React.JSX.Element => (
					<li key={part.id}>
						<Link
							href={SHOWCASE_ROUTES.part(slug, part.id)}
							aria-current={part.id === current?.id ? "page" : undefined}
							className={buttonVariants({ variant: part.id === current?.id ? "secondary" : "ghost", size: "sm" })}>
							{part.label}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

/** One group of a grouped component page, by its id; `undefined` when the component has no such group. */
export function resolveShowcasePart(slug: string, partId: string): ShowcasePart | undefined {
	const parts = SHOWCASE_FEATURE_PARTS.get(slug) ?? [];
	return parts.find((part: ShowcasePart): boolean => part.id === partId);
}

export interface ShowcaseComponentPageProps {
	readonly item: ShowcaseCatalogItem;
	/** The component's written overview; `null` while it has none. */
	readonly overview: ShowcaseOverview | null;
	/** On a group's route, the group shown (from `resolveShowcasePart`); `null` on the component's own page: every example. */
	readonly part: ShowcasePart | null;
}

/**
 * One component's page, laid out like reui.io's: its name and purpose with a
 * link to its docs, when to use it, every feature (live preview and code),
 * the overview, the FAQ, then its neighbours in catalog order. Everything but
 * the features is server-rendered; the features download as one chunk and
 * mount as they near the viewport.
 */
export function ShowcaseComponentPage({ item, overview, part }: ShowcaseComponentPageProps): React.JSX.Element {
	const { key, entry, family } = item;
	const meta = SHOWCASE_FAMILY_META[family.id];
	const FamilyIcon = meta.icon;
	const features = SHOWCASE_FEATURE_INDEX.get(entry.slug) ?? [];
	const parts = SHOWCASE_FEATURE_PARTS.get(entry.slug) ?? [];
	const shownFeatures = part === null ? features : features.filter((feature: ShowcaseFeatureSummary): boolean => feature.part === part.id);
	const { previous, next } = showcaseNeighbours(key);
	return (
		<article aria-labelledby="showcase-component-title" className="flex flex-col gap-12">
			<header className="flex flex-col gap-4 border-b pb-8">
				<nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<Link href={SHOWCASE_ROUTES.index} className="rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
						Showcase
					</Link>
					<span aria-hidden="true">/</span>
					<Link
						href={`${SHOWCASE_ROUTES.index}#${family.id}`}
						className="flex items-center gap-2 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
						<IconTile tone={meta.tone} size="xs">
							<FamilyIcon aria-hidden="true" />
						</IconTile>
						{family.title}
					</Link>
				</nav>
				<div className="flex flex-wrap items-start justify-between gap-4">
					<h1 id="showcase-component-title" className="font-mono text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						{entry.name}
					</h1>
					<Link href={SHOWCASE_ROUTES.docs(entry.slug)} className={buttonVariants({ variant: "outline", size: "sm" })}>
						<BookOpen aria-hidden="true" />
						Docs &amp; API
					</Link>
				</div>
				<p className="max-w-3xl text-base text-muted-foreground">{entry.description}</p>
				<Badge variant="secondary" radius="full" className="self-start tabular-nums">
					{featureCountLabel(features.length)}
				</Badge>
			</header>
			{overview === null ? null : <Guidance overview={overview} />}
			<section aria-labelledby="showcase-examples-title" className="flex flex-col gap-6">
				<h2 id="showcase-examples-title" className="font-heading text-2xl font-semibold tracking-tight">
					Examples
				</h2>
				{parts.length === 0 ? null : <PartNav slug={entry.slug} name={entry.name} parts={parts} current={part} />}
				{shownFeatures.length > 1 ? (
					<nav aria-label={`${entry.name} features`}>
						<ul className="flex flex-wrap gap-1.5">
							{shownFeatures.map((feature: ShowcaseFeatureSummary): React.JSX.Element => (
								<li key={feature.id}>
									<a href={`#${feature.anchor}`} className={buttonVariants({ variant: "outline", size: "xs" })}>
										{feature.label}
									</a>
								</li>
							))}
						</ul>
					</nav>
				) : null}
				<ShowcaseFeatures slug={entry.slug} part={part === null ? null : part.id} />
			</section>
			{overview === null ? null : (
				<section aria-label={`About ${entry.name}`} className="max-w-3xl">
					<Markdown source={overview.body} />
				</section>
			)}
			{overview === null ? null : <FrequentlyAskedQuestions faq={overview.faq} />}
			<nav aria-label="More components" className="flex flex-col gap-3 border-t pt-8 sm:flex-row">
				{previous === undefined ? <span className="hidden flex-1 sm:block" /> : <NeighbourLink item={previous} direction="previous" />}
				{next === undefined ? <span className="hidden flex-1 sm:block" /> : <NeighbourLink item={next} direction="next" />}
			</nav>
			<ReuiProCallToAction />
		</article>
	);
}
