"use client";

import * as React from "react";

import { LazySection } from "@/components/common/lazy-section";
import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";

/** Height each example reserves until it mounts, so the page does not jump while scrolling. */
const EXAMPLE_PLACEHOLDER_HEIGHT = "h-56";

/** Example numbers are padded to two digits (`01`…`61`), so the labels line up. */
const EXAMPLE_NUMBER_DIGITS = 2;

/*
 * A static box, not animated bones: a component can have sixty examples, and
 * sixty shimmering placeholders repaint on every frame of a scroll.
 */
const EXAMPLE_PLACEHOLDER = <div data-example-placeholder="" className={`${EXAMPLE_PLACEHOLDER_HEIGHT} w-full rounded-lg bg-muted/40`} />;

export interface ExampleGridProps {
	readonly examples: readonly GalleryExample[];
}

/**
 * A component's worked examples, one to a row, each at the page's full width
 * so it has room to be tried out. The preview is a full-width row that
 * centres its example: an example sized `w-full` fills it, one with its own
 * `max-w-*` sits centred, one with no width keeps its natural size. (A
 * shrink-to-fit wrapper here would resolve every `w-full` against zero width
 * and crush the example.) Each example mounts only when it nears the viewport
 * (`LazySection`), and once mounted, `content-visibility: auto` lets the
 * browser skip laying out and painting the examples scrolled out of view.
 */
export function ExampleGrid({ examples }: ExampleGridProps): React.JSX.Element {
	return (
		<ul className="flex flex-col gap-6" aria-label="Examples">
			{examples.map((example: GalleryExample, index: number): React.JSX.Element => (
				<li
					key={example.id}
					className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground [contain-intrinsic-size:auto_18rem] [content-visibility:auto]">
					<div className="flex items-center gap-3 border-b px-4 py-2.5">
						<span aria-hidden="true" className="font-mono text-xs text-muted-foreground tabular-nums">
							{String(index + 1).padStart(EXAMPLE_NUMBER_DIGITS, "0")}
						</span>
						<p className="min-w-0 flex-1 truncate text-sm font-medium" data-example-id={example.id}>
							{example.label}
						</p>
					</div>
					<div className="min-w-0 bg-background/60 p-6 sm:p-10">
						<LazySection height={EXAMPLE_PLACEHOLDER_HEIGHT} placeholder={EXAMPLE_PLACEHOLDER}>
							<div data-example-preview="" className="flex min-h-40 w-full min-w-0 items-center justify-center">
								<example.component />
							</div>
						</LazySection>
					</div>
				</li>
			))}
		</ul>
	);
}
