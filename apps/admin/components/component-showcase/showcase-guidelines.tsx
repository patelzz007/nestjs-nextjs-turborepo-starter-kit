"use client";

import { CircleCheck, CircleX, type LucideIcon } from "lucide-react";
import * as React from "react";

import { Markdown } from "@/components/docs/markdown";
import { FeatureCode } from "@/components/component-showcase/feature-code";
import type { ShowcaseGuideline, ShowcaseGuidelineSide } from "@/components/component-showcase/showcase-feature";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";

/** Which side of a pair: the right way or the wrong way. */
export type GuidelineVerdict = "do" | "dont";

/** How each side of a pair is told apart: its heading, its glyph and its colour, and the card's edge. */
interface VerdictLook {
	readonly title: string;
	readonly icon: LucideIcon;
	readonly iconClassName: string;
	readonly cardClassName: string;
}

const VERDICT: Readonly<Record<GuidelineVerdict, VerdictLook>> = {
	do: { title: "Do", icon: CircleCheck, iconClassName: "text-success", cardClassName: "border-success/60" },
	dont: { title: "Don't", icon: CircleX, iconClassName: "text-destructive", cardClassName: "border-destructive/60" },
};

interface GuidelineSideCardProps {
	readonly verdict: GuidelineVerdict;
	readonly side: ShowcaseGuidelineSide;
}

/** One side of a pair: its verdict, a live render of it, what it says, and its code a click away. */
function GuidelineSideCard({ verdict, side }: GuidelineSideCardProps): React.JSX.Element {
	const [showCode, setShowCode] = React.useState(false);
	const toggleCode = React.useCallback((): void => {
		setShowCode((shown: boolean): boolean => !shown);
	}, []);
	const meta = VERDICT[verdict];
	const Glyph = meta.icon;
	return (
		<div data-guideline-side={side.file} className={cn("flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4", meta.cardClassName)}>
			<div className="flex items-center gap-2">
				<Glyph aria-hidden="true" className={cn("size-4", meta.iconClassName)} />
				<span className="text-sm font-semibold text-foreground">{meta.title}</span>
			</div>
			<div data-slot="guideline-preview" className="flex min-h-28 items-center justify-center rounded-lg border border-border bg-background p-4">
				{side.render()}
			</div>
			<div className="text-sm text-muted-foreground [&_p]:m-0">
				<Markdown source={side.text} />
			</div>
			<Button variant="link" size="sm" className="self-start px-0" aria-expanded={showCode} onClick={toggleCode}>
				{showCode ? "Hide code" : "Show code"}
			</Button>
			{showCode ? <FeatureCode source={side.source} title={`${side.file}.tsx`} /> : null}
		</div>
	);
}

export interface ShowcaseGuidelinesProps {
	readonly guidelines: readonly ShowcaseGuideline[];
}

/** The component's Do / Don't pairs: for each, the right way and the wrong way, both live, side by side. */
export function ShowcaseGuidelines({ guidelines }: ShowcaseGuidelinesProps): React.JSX.Element {
	return (
		<section id="do-and-dont" aria-labelledby="do-and-dont-title" data-showcase-guidelines="" className="flex scroll-mt-24 flex-col gap-6">
			<h2 id="do-and-dont-title" className="text-xl font-semibold tracking-tight text-foreground">
				Do and don&apos;t
			</h2>
			{guidelines.map((guideline: ShowcaseGuideline): React.JSX.Element => (
				<div key={guideline.title} className="flex flex-col gap-3">
					<h3 className="text-base font-semibold tracking-tight text-foreground">{guideline.title}</h3>
					<div className="grid gap-4 md:grid-cols-2">
						<GuidelineSideCard verdict="do" side={guideline.do} />
						<GuidelineSideCard verdict="dont" side={guideline.dont} />
					</div>
				</div>
			))}
		</section>
	);
}
