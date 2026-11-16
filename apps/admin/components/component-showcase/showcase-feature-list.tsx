"use client";

import { Code2, Eye } from "lucide-react";
import * as React from "react";

import { LazySection } from "@/components/common/lazy-section";
import { Frame, FramePanel } from "@workspace/ui/components/frame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { FeatureCode } from "@/components/component-showcase/feature-code";
import type { ShowcaseFeature, ShowcaseGuideline } from "@/components/component-showcase/showcase-feature";
import { ShowcaseGuidelines } from "@/components/component-showcase/showcase-guidelines";

/** Height reserved for a live example until it mounts: the preview panel's minimum. */
const PREVIEW_HEIGHT = "h-40";
/**
 * Previews mount this far ahead of the viewport, so the swap from placeholder
 * to content — and the work it costs — happens off screen while scrolling.
 */
const MOUNT_AHEAD_MARGIN = "2000px 0px";

/** The tabs of one example. */
export type FeatureView = "preview" | "code";
const DEFAULT_VIEW: FeatureView = "preview";

/**
 * A static box until a preview is about to scroll into view: a page holds a
 * lazy preview per feature, and that many animated bones would repaint on
 * every scrolled frame (see `LazySection`).
 */
const PREVIEW_PLACEHOLDER: React.ReactNode = <div className="h-40 w-full" />;

interface FeatureSectionProps {
	readonly feature: ShowcaseFeature;
}

/**
 * One feature: its name and what it is for, then its example under two tabs —
 * Preview (running live) and Code (its exact source). The code mounts only when
 * its tab is opened, so a page of many features highlights none up front.
 */
function FeatureSection({ feature }: FeatureSectionProps): React.JSX.Element {
	const titleId = `${feature.anchor}-title`;
	return (
		<section id={feature.anchor} aria-labelledby={titleId} data-showcase-feature={feature.id} className="flex scroll-mt-24 flex-col gap-3">
			<div className="flex flex-col gap-1">
				<h3 id={titleId} className="text-base font-semibold tracking-tight text-foreground">
					<a href={`#${feature.anchor}`} className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
						{feature.label}
					</a>
				</h3>
				<p className="max-w-3xl text-sm text-muted-foreground">{feature.description}</p>
			</div>
			<Tabs defaultValue={DEFAULT_VIEW}>
				<div className="flex items-center justify-between gap-3">
					<TabsList variant="line" aria-label={`${feature.label} views`} data-feature-views="">
						<TabsTrigger value="preview">
							<Eye aria-hidden="true" />
							Preview
						</TabsTrigger>
						<TabsTrigger value="code">
							<Code2 aria-hidden="true" />
							Code
						</TabsTrigger>
					</TabsList>
					<span className="truncate font-mono text-xs text-muted-foreground">{feature.id}</span>
				</div>
				<TabsContent value="preview">
					<Frame>
						<FramePanel aria-label={`${feature.label} preview`} role="region">
							<LazySection height={PREVIEW_HEIGHT} placeholder={PREVIEW_PLACEHOLDER} rootMargin={MOUNT_AHEAD_MARGIN} reveal="instant" commit="urgent">
								<div data-slot="feature-preview" className="flex min-h-40 w-full items-center justify-center">
									{feature.render()}
								</div>
							</LazySection>
						</FramePanel>
					</Frame>
				</TabsContent>
				<TabsContent value="code">
					<div data-slot="feature-code-slot">
						<FeatureCode source={feature.source} title={`${feature.file}.tsx`} />
					</div>
				</TabsContent>
			</Tabs>
		</section>
	);
}

/**
 * The feature a link points at (`…/code-block#soft-wrap`), scrolled into view
 * once the list exists: the list arrives in its own chunk, after the router
 * looked for the anchor, so the browser's own jump found nothing to scroll to.
 */
export function useScrollToLinkedFeature(): void {
	React.useEffect((): void => {
		const anchor = decodeURIComponent(window.location.hash.replace(/^#/u, ""));
		if (anchor.length === 0) {
			return;
		}
		document.getElementById(anchor)?.scrollIntoView({ block: "start" });
	}, []);
}

export interface ShowcaseFeatureListProps {
	readonly features: readonly ShowcaseFeature[];
	/** The component's Do / Don't pairs, after its features. */
	readonly guidelines?: readonly ShowcaseGuideline[] | undefined;
}

const NO_GUIDELINES: readonly ShowcaseGuideline[] = [];

/**
 * Every feature of one component, in order. Each preview mounts well ahead of
 * the viewport (no reveal animation) and each example is its own chunk, so a
 * long page stays light and nothing pops in on screen.
 */
export function ShowcaseFeatureList({ features, guidelines = NO_GUIDELINES }: ShowcaseFeatureListProps): React.JSX.Element {
	useScrollToLinkedFeature();
	return (
		<div className="flex flex-col gap-12">
			{features.map((feature: ShowcaseFeature): React.JSX.Element => (
				<FeatureSection key={feature.id} feature={feature} />
			))}
			{guidelines.length === 0 ? null : <ShowcaseGuidelines guidelines={guidelines} />}
		</div>
	);
}
