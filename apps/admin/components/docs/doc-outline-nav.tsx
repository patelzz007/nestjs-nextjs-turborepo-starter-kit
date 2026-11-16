"use client";

import * as React from "react";

import { cn } from "@workspace/ui/lib/core/utils";

import type { DocHeading } from "./doc-outline";

/** A section is "being read" once its heading has reached the top third of the viewport. */
const READING_LINE_RATIO = 1 / 3;

/** The id of the last heading at or above the reading line, or the first heading when none is. */
export function headingAtReadingLine(ids: readonly string[], readingLine: number): string | undefined {
	let current = ids.at(0);
	for (const id of ids) {
		const heading = document.getElementById(id);
		if (heading !== null && heading.getBoundingClientRect().top <= readingLine) {
			current = id;
		}
	}
	return current;
}

/**
 * The id of the section being read. Measured on every scroll (once per frame) rather than with an
 * IntersectionObserver, so a jump — an outline link, the end key — lands on the right section too.
 * The panel scrolls inside the shell, so scroll events are caught on the way down (capture).
 */
function useActiveHeading(ids: readonly string[]): string | undefined {
	const [active, setActive] = React.useState<string | undefined>(ids.at(0));

	React.useEffect((): (() => void) => {
		let frame: number | undefined;
		const update = (): void => {
			frame = undefined;
			setActive(headingAtReadingLine(ids, window.innerHeight * READING_LINE_RATIO));
		};
		const schedule = (): void => {
			frame ??= window.requestAnimationFrame(update);
		};
		update();
		document.addEventListener("scroll", schedule, { capture: true, passive: true });
		window.addEventListener("resize", schedule, { passive: true });
		return (): void => {
			document.removeEventListener("scroll", schedule, { capture: true });
			window.removeEventListener("resize", schedule);
			if (frame !== undefined) {
				window.cancelAnimationFrame(frame);
			}
		};
	}, [ids]);

	return active;
}

export interface DocOutlineNavProps {
	readonly headings: readonly DocHeading[];
	readonly label: string;
}

/** The guide's "On this page" outline: links to each section, with the one being read highlighted. */
export function DocOutlineNav({ headings, label }: DocOutlineNavProps): React.JSX.Element | null {
	const ids = React.useMemo((): readonly string[] => headings.map((heading) => heading.id), [headings]);
	const active = useActiveHeading(ids);

	if (headings.length === 0) {
		return null;
	}
	return (
		<nav aria-labelledby="doc-outline-heading" className="flex flex-col gap-3">
			<p id="doc-outline-heading" className="text-xs font-medium text-muted-foreground">
				{label}
			</p>
			<ul className="flex flex-col border-s border-border">
				{headings.map((heading) => {
					const isActive = heading.id === active;
					return (
						<li key={heading.id}>
							<a
								href={`#${heading.id}`}
								aria-current={isActive ? "location" : undefined}
								className={cn(
									"-ms-px block border-s border-transparent py-1 text-sm leading-snug text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors",
									heading.depth === 2 ? "ps-3" : "ps-6",
									isActive && "border-foreground font-medium text-foreground",
								)}>
								{heading.text}
							</a>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
