import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { DetailSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type * as React from "react";

import type { SkeletonRegionLabelsOverride } from "@/components/loading/loading-labels";
import { BadgeSkeleton, CardHeadingSkeleton } from "@/components/loading/skeleton-parts";

// ── Editor (new / edit) ──────────────────────────────────────────────────────

/** The field layout of one catalog form, in render order (components/catalog/*-form.tsx). */
export interface CatalogFormShape {
	/** Inputs in the two-column grid at the top of the form. */
	readonly gridFields: number;
	/** Full-width single-line inputs under the grid. */
	readonly singleLineFields: number;
	/** Full-width textareas after those. */
	readonly multilineFields: number;
	/** Switches in the row above the actions. */
	readonly switches: number;
}

/** `ProductForm`: name, slug, SKU, category, price, compare-at price, stock, weight, brand, image URL · short description · description · active, featured. */
export const PRODUCT_FORM_SHAPE: CatalogFormShape = { gridFields: 10, singleLineFields: 1, multilineFields: 1, switches: 2 };
/** `CategoryForm`: name, slug, sort order · description · active. */
export const CATEGORY_FORM_SHAPE: CatalogFormShape = { gridFields: 3, singleLineFields: 0, multilineFields: 1, switches: 1 };

/** One `TextField`: label over its control. */
function FieldSkeleton({ multiline }: { readonly multiline: boolean }): React.JSX.Element {
	return (
		<div data-skeleton="catalog-field" className="flex flex-col gap-2">
			<Skeleton variant="text" className="h-3.5 w-28" />
			<Skeleton className={multiline ? "h-16 w-full" : "h-9 w-full"} />
		</div>
	);
}

/** A catalog form's bones — the grid, the full-width fields, the switch row, then the left-aligned submit + cancel. */
export function CatalogFormSkeleton({ shape }: { readonly shape: CatalogFormShape }): React.JSX.Element {
	return (
		<div data-skeleton="catalog-form" className="flex flex-col gap-6">
			<div className="grid gap-4 sm:grid-cols-2">
				{placeholderKeys("grid-field", shape.gridFields).map((key) => (
					<FieldSkeleton key={key} multiline={false} />
				))}
			</div>
			{placeholderKeys("line-field", shape.singleLineFields).map((key) => (
				<FieldSkeleton key={key} multiline={false} />
			))}
			{placeholderKeys("multiline-field", shape.multilineFields).map((key) => (
				<FieldSkeleton key={key} multiline />
			))}
			<div className="flex flex-wrap gap-6">
				{placeholderKeys("switch", shape.switches).map((key) => (
					<div key={key} data-skeleton="catalog-switch" className="flex items-center gap-2">
						<Skeleton className="h-5 w-9 rounded-full" />
						<Skeleton variant="text" className="h-3.5 w-16" />
					</div>
				))}
			</div>
			<div className="flex gap-2">
				<Skeleton className="h-9 w-32" />
				<Skeleton className="h-9 w-20" />
			</div>
		</div>
	);
}

export interface CatalogEditorPageSkeletonProps {
	readonly labels: SkeletonRegionLabelsOverride;
	readonly shape: CatalogFormShape;
}

/** `/catalog/{products,categories}/new` and `…/[id]/edit`: the `h1` over the bare (card-less) form. */
export function CatalogEditorPageSkeleton({ labels, shape }: CatalogEditorPageSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className="flex flex-col gap-6">
			<Skeleton className="h-8 w-56 max-w-full" />
			<CatalogFormSkeleton shape={shape} />
		</SkeletonRegion>
	);
}

// ── Detail ───────────────────────────────────────────────────────────────────

/** The detail sheet of one catalog entity (`*-detail-view.tsx`). */
export interface CatalogDetailShape {
	/** Label/value pairs in the card's two-column grid. */
	readonly fields: number;
	/** Status badges beside the card title. */
	readonly badges: number;
}

/** `ProductDetailView`: fifteen fields; Active + Featured badges. */
export const PRODUCT_DETAIL_SHAPE: CatalogDetailShape = { fields: 15, badges: 2 };
/** `SampleCategoryDetailView`: six fields; the Active badge. */
export const CATEGORY_DETAIL_SHAPE: CatalogDetailShape = { fields: 6, badges: 1 };

export interface CatalogDetailPageSkeletonProps {
	readonly labels: SkeletonRegionLabelsOverride;
	readonly shape: CatalogDetailShape;
}

/** `/catalog/{products,categories}/[id]`: the back + edit row over the entity card (name, slug, badges, field grid). */
export function CatalogDetailPageSkeleton({ labels, shape }: CatalogDetailPageSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Skeleton className="h-9 w-44" />
				<Skeleton className="h-9 w-20" />
			</div>
			<Card data-skeleton="catalog-detail">
				<CardHeader className="flex flex-row items-start justify-between gap-4">
					<CardHeadingSkeleton />
					<div className="flex flex-wrap gap-2">
						{placeholderKeys("badge", shape.badges).map((key) => (
							<BadgeSkeleton key={key} />
						))}
					</div>
				</CardHeader>
				<CardContent>
					<DetailSkeleton surface="plain" rows={shape.fields} />
				</CardContent>
			</Card>
		</SkeletonRegion>
	);
}
