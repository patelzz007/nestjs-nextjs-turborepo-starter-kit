"use client";

import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

import { LazySection } from "@/components/common/lazy-section";
import { useIsGallerySectionShown } from "@/components/component-gallery/active-gallery-component";
import { GALLERY_EXAMPLE_COUNTS } from "@/components/component-gallery/examples/examples-manifest";
import { GALLERY_EXAMPLE_SECTIONS } from "@/components/component-gallery/examples/examples-registry";
import {
	EXAMPLE_ONLY_KEYS,
	GALLERY_ENTRIES,
	GALLERY_FAMILIES,
	type GalleryComponentKey,
	type GalleryEntry,
	type GalleryFamilyId,
} from "@/components/component-gallery/gallery-catalog";

/** Reserved height of a section's demos until they mount (`LazySection`), so the page below does not jump. */
export type DemoHeight = "h-24" | "h-40" | "h-56" | "h-72" | "h-96" | "h-[400px]" | "h-[640px]";

export interface ComponentSectionProps {
	readonly entry: GalleryEntry;
	/** Height the demos are expected to take, reserved while they are still off screen. */
	readonly height?: DemoHeight;
	/** The live demos; omitted for a component shown through its worked examples only. */
	readonly children?: React.ReactNode;
}

interface GalleryBlockProps {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	/** Shown beside the title (the example count). */
	readonly meta?: React.ReactNode;
	readonly children: React.ReactNode;
}

/** One titled block of a component page ("Live demo", "Examples"). */
function GalleryBlock({ id, title, description, meta, children }: GalleryBlockProps): React.JSX.Element {
	const titleId = `${id}-title`;
	return (
		<section id={id} aria-labelledby={titleId} className="flex scroll-mt-6 flex-col gap-4">
			<header className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
						{title}
					</h2>
					{meta}
				</div>
				<p className="text-sm text-muted-foreground">{description}</p>
			</header>
			{children}
		</section>
	);
}

/**
 * One component of the gallery: its live demos, then its worked examples
 * (examples/, when it has any), under the page's own heading (the component's
 * name). On `/components/<slug>` only the active component's section renders
 * (`ActiveGalleryComponentProvider`); the demos still mount only as they near
 * the viewport.
 */
export function ComponentSection({ entry, height = "h-40", children }: ComponentSectionProps): React.JSX.Element | null {
	const shown = useIsGallerySectionShown(entry.id);
	if (!shown) {
		return null;
	}
	const renderExamples = GALLERY_EXAMPLE_SECTIONS.get(entry.id);
	const exampleCount = GALLERY_EXAMPLE_COUNTS.get(entry.id) ?? 0;
	return (
		<section id={entry.id} aria-label={entry.name} data-gallery-section="" className="flex flex-col gap-12">
			{children === undefined ? null : (
				<GalleryBlock id={`${entry.id}-demo`} title="Live demo" description="Every variant, size and state, wired to state this page holds.">
					<LazySection height={height}>{children}</LazySection>
				</GalleryBlock>
			)}
			{renderExamples === undefined ? null : (
				<GalleryBlock
					id={`${entry.id}-examples`}
					title="Examples"
					description="Worked compositions, each one live."
					meta={
						<Badge variant="secondary" radius="full" size="sm">
							{exampleCount}
						</Badge>
					}>
					{renderExamples()}
				</GalleryBlock>
			)}
		</section>
	);
}

export interface DemoSurfaceProps {
	readonly children: React.ReactNode;
	readonly className?: string;
}

/** The card a section's demos sit on. */
export function DemoSurface({ children, className }: DemoSurfaceProps): React.JSX.Element {
	return <div className={cn("flex flex-col gap-6 rounded-xl border bg-card p-5 text-card-foreground shadow-xs sm:p-8", className)}>{children}</div>;
}

export interface DemoRowProps {
	/** What this row demonstrates (`Variants`, `Sizes`, `States`…). */
	readonly label: string;
	readonly children: React.ReactNode;
	readonly className?: string;
}

/** One labelled row of examples inside a `DemoSurface`. */
export function DemoRow({ label, children, className }: DemoRowProps): React.JSX.Element {
	return (
		<div className="flex flex-col gap-2">
			<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
			<div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
		</div>
	);
}

export interface DemoValueProps {
	/** What the value is (`Pressed`, `Selected`…). */
	readonly label: string;
	readonly children: React.ReactNode;
}

/** Echoes a demo's controlled state, so the reader sees the value the page holds. */
export function DemoValue({ label, children }: DemoValueProps): React.JSX.Element {
	return (
		<p className="text-xs text-muted-foreground">
			{label}: <span className="font-medium text-foreground tabular-nums">{children}</span>
		</p>
	);
}

export interface ExampleOnlySectionsProps {
	readonly familyId: GalleryFamilyId;
}

/** The family's components that are shown through their worked examples only (`EXAMPLE_ONLY_KEYS`), in catalog order. */
export function ExampleOnlySections({ familyId }: ExampleOnlySectionsProps): React.JSX.Element {
	const family = GALLERY_FAMILIES.find((candidate) => candidate.id === familyId);
	const keys = (family?.keys ?? []).filter((key: GalleryComponentKey): boolean => EXAMPLE_ONLY_KEYS.has(key));
	return (
		<>
			{keys.map((key: GalleryComponentKey): React.JSX.Element => (
				<ComponentSection key={key} entry={GALLERY_ENTRIES[key]} />
			))}
		</>
	);
}
