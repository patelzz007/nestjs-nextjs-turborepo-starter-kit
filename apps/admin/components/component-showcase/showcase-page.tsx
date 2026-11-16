import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { SHOWCASE_FEATURE_INDEX } from "@/components/component-showcase/generated/feature-index";
import {
	NOT_SHOWN_COMPONENTS,
	SHOWCASE_CATALOG_ORDER,
	SHOWCASE_ENTRIES,
	SHOWCASE_FAMILIES,
	type ShowcaseComponentKey,
	type ShowcaseFamily,
} from "@/components/component-showcase/showcase-catalog";
import type { ShowcaseFeatureSummary } from "@/components/component-showcase/showcase-feature";
import { SHOWCASE_FAMILY_META } from "@/components/component-showcase/showcase-family-meta";
import { SHOWCASE_ROUTES } from "@/components/component-showcase/showcase-routes";
import { formatCount } from "@/lib/format/numbers";

/** Feature names a component card previews before "and N more". */
const PREVIEWED_FEATURES = 3;

const TOTAL_FEATURES = [...SHOWCASE_FEATURE_INDEX.values()].reduce((sum: number, features: readonly ShowcaseFeatureSummary[]): number => sum + features.length, 0);
const PAGE_TITLE = "Component showcase";
const PAGE_DESCRIPTION = `${formatCount(SHOWCASE_CATALOG_ORDER.length)} UI kit components and their ${formatCount(TOTAL_FEATURES)} features, each running live beside the exact code that renders it. Search above, or browse by family.`;

/** "3 features" / "1 feature". */
export function featureCountLabel(count: number): string {
	return count === 1 ? "1 feature" : `${formatCount(count)} features`;
}

interface ComponentCardProps {
	readonly componentKey: ShowcaseComponentKey;
}

/** One component: its name, what it is for, how many features its page shows, and the first few of them. */
function ComponentCard({ componentKey }: ComponentCardProps): React.JSX.Element {
	const entry = SHOWCASE_ENTRIES[componentKey];
	const features = SHOWCASE_FEATURE_INDEX.get(entry.slug) ?? [];
	const previewed = features
		.slice(0, PREVIEWED_FEATURES)
		.map((feature: ShowcaseFeatureSummary): string => feature.label)
		.join(" · ");
	return (
		<li className="flex">
			<Link
				href={SHOWCASE_ROUTES.component(entry.slug)}
				data-showcase-card={entry.slug}
				className="group/card flex w-full flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground transition-colors outline-none hover:border-foreground/20 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
				<div className="flex items-start justify-between gap-3">
					<h3 className="font-mono text-sm font-semibold text-foreground">{entry.name}</h3>
					<ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/card:text-primary" />
				</div>
				<p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{entry.description}</p>
				<div className="flex min-w-0 items-center gap-2">
					<Badge variant="secondary" radius="full" size="sm" className="shrink-0 tabular-nums">
						{featureCountLabel(features.length)}
					</Badge>
					<span className="truncate text-xs text-muted-foreground">{previewed}</span>
				</div>
			</Link>
		</li>
	);
}

interface FamilySectionProps {
	readonly family: ShowcaseFamily;
}

/** One family: its heading, then a card per component. */
function FamilySection({ family }: FamilySectionProps): React.JSX.Element {
	const meta = SHOWCASE_FAMILY_META[family.id];
	const FamilyIcon = meta.icon;
	const titleId = `${family.id}-title`;
	return (
		<section id={family.id} aria-labelledby={titleId} className="flex scroll-mt-24 flex-col gap-4">
			<header className="flex items-center gap-3">
				<IconTile tone={meta.tone} size="sm">
					<FamilyIcon aria-hidden="true" />
				</IconTile>
				<div className="flex flex-col gap-0.5">
					<h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
						{family.title}
					</h2>
					<p className="text-sm text-muted-foreground">{meta.summary}</p>
				</div>
			</header>
			<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{family.keys.map((key: ShowcaseComponentKey): React.JSX.Element => (
					<ComponentCard key={key} componentKey={key} />
				))}
			</ul>
		</section>
	);
}

/**
 * The showcase's index: every UI kit component, family by family, as a card
 * that opens its own page (every feature, live, with its code). Nothing here
 * runs an example, so the page is light whatever the catalog's size.
 */
export function ShowcasePage(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-10">
			<header className="flex flex-col gap-1">
				<h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{PAGE_TITLE}</h1>
				<p className="text-sm text-muted-foreground sm:text-base">{PAGE_DESCRIPTION}</p>
			</header>
			<nav aria-label="Component families">
				<ul className="flex flex-wrap gap-2">
					{SHOWCASE_FAMILIES.map((family: ShowcaseFamily): React.JSX.Element => (
						<li key={family.id}>
							<a href={`#${family.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
								{family.title}
								<Badge variant="secondary" radius="full" size="sm" className="tabular-nums">
									{family.keys.length}
								</Badge>
							</a>
						</li>
					))}
				</ul>
			</nav>
			{SHOWCASE_FAMILIES.map((family: ShowcaseFamily): React.JSX.Element => (
				<FamilySection key={family.id} family={family} />
			))}
			<section aria-labelledby="showcase-not-shown-title" className="flex flex-col gap-2 border-t pt-6">
				<h2 id="showcase-not-shown-title" className="text-sm font-semibold text-foreground">
					Not shown here
				</h2>
				<p className="text-sm text-muted-foreground">
					App-level pieces are mounted once by the layout or composed from the components above, so they have no standalone example:
				</p>
				<ul className="list-disc ps-5 text-sm text-muted-foreground">
					{NOT_SHOWN_COMPONENTS.map((item: string): React.JSX.Element => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>
		</div>
	);
}
