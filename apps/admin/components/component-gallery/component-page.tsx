import { Badge } from "@workspace/ui/components/badge";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { ActionsFamily } from "@/components/component-gallery/actions-family";
import { ActiveGalleryComponentProvider } from "@/components/component-gallery/active-gallery-component";
import { DataDisplayFamily } from "@/components/component-gallery/data-display-family";
import { DisclosureNavigationFamily } from "@/components/component-gallery/disclosure-navigation-family";
import { GALLERY_EXAMPLE_COUNTS } from "@/components/component-gallery/examples/examples-manifest";
import { FeedbackStatusFamily } from "@/components/component-gallery/feedback-status-family";
import { FormInputsFamily } from "@/components/component-gallery/form-inputs-family";
import { GalleryBreadcrumb } from "@/components/component-gallery/gallery-breadcrumb";
import { EXAMPLE_ONLY_KEYS, galleryNeighbours, type GalleryCatalogItem, type GalleryFamilyId } from "@/components/component-gallery/gallery-catalog";
import { GALLERY_FAMILY_META } from "@/components/component-gallery/gallery-family-meta";
import { MediaContentFamily } from "@/components/component-gallery/media-content-family";
import { OverlaysFamily } from "@/components/component-gallery/overlays-family";
import { SelectionFamily } from "@/components/component-gallery/selection-family";
import { formatCount } from "@/lib/format/numbers";
import { ROUTES } from "@/lib/routes";

/**
 * The demos of each family (`GALLERY_FAMILIES`) — a `Record`, so a family
 * without demos fails to compile. Each is a client component: a page renders
 * one, so the browser downloads only that family's code.
 */
const FAMILY_DEMOS: Readonly<Record<GalleryFamilyId, () => React.JSX.Element>> = {
	"family-actions": ActionsFamily,
	"family-form-inputs": FormInputsFamily,
	"family-selection": SelectionFamily,
	"family-overlays": OverlaysFamily,
	"family-disclosure-navigation": DisclosureNavigationFamily,
	"family-feedback-status": FeedbackStatusFamily,
	"family-data-display": DataDisplayFamily,
	"family-media-content": MediaContentFamily,
};

interface NeighbourLinkProps {
	readonly item: GalleryCatalogItem;
	readonly direction: "previous" | "next";
}

function NeighbourLink({ item, direction }: NeighbourLinkProps): React.JSX.Element {
	const isNext = direction === "next";
	return (
		<Link
			href={ROUTES.components.component(item.entry.slug)}
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

export interface ComponentPageProps {
	readonly item: GalleryCatalogItem;
}

/**
 * `/components/<slug>`: one component — its name, family and description,
 * then its live demo and worked examples, then links to its neighbours in
 * catalog order. The family module renders only this component's section
 * (`ActiveGalleryComponentProvider`).
 */
export function ComponentPage({ item }: ComponentPageProps): React.JSX.Element {
	const { key, entry, family } = item;
	const meta = GALLERY_FAMILY_META[family.id];
	const FamilyIcon = meta.icon;
	const Demos = FAMILY_DEMOS[family.id];
	const examples = GALLERY_EXAMPLE_COUNTS.get(entry.id) ?? 0;
	const { previous, next } = galleryNeighbours(key);
	return (
		<article aria-labelledby="component-page-title" className="flex flex-col gap-12">
			<GalleryBreadcrumb label={entry.name} />
			<header className="flex flex-col gap-4 border-b pb-8">
				<Link
					href={`${ROUTES.components.index}#${family.id}`}
					className="flex items-center gap-2 self-start rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
					<IconTile tone={meta.tone} size="xs">
						<FamilyIcon aria-hidden="true" />
					</IconTile>
					{family.title}
				</Link>
				<h1 id="component-page-title" className="font-mono text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
					{entry.name}
				</h1>
				<p className="max-w-3xl text-base text-muted-foreground">{entry.description}</p>
				<div className="flex flex-wrap items-center gap-2">
					{EXAMPLE_ONLY_KEYS.has(key) ? null : (
						<Badge variant="success-light" radius="full">
							Live demo
						</Badge>
					)}
					{examples > 0 ? (
						<Badge variant="secondary" radius="full">
							{examples === 1 ? "1 example" : `${formatCount(examples)} examples`}
						</Badge>
					) : null}
				</div>
			</header>
			<ActiveGalleryComponentProvider sectionId={entry.id}>
				<Demos />
			</ActiveGalleryComponentProvider>
			<nav aria-label="More components" className="flex flex-col gap-3 border-t pt-8 sm:flex-row">
				{previous === undefined ? <span className="hidden flex-1 sm:block" /> : <NeighbourLink item={previous} direction="previous" />}
				{next === undefined ? <span className="hidden flex-1 sm:block" /> : <NeighbourLink item={next} direction="next" />}
			</nav>
		</article>
	);
}
