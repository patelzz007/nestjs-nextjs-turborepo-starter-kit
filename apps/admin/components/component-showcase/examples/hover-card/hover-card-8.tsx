"use client";

import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";

interface Release {
	readonly version: string;
	readonly date: string;
	readonly tag: string;
	readonly tagVariant: NonNullable<React.ComponentProps<typeof Badge>["variant"]>;
	readonly description: string;
}

const LATEST_RELEASE: Release = {
	version: "v3.2.0",
	date: "Feb 5, 2026",
	tag: "Latest",
	tagVariant: "success",
	description: "Added real-time collaboration cursors, improved markdown editor performance, and fixed PDF export layout issues.",
};

const releases: readonly Release[] = [
	LATEST_RELEASE,
	{
		version: "v3.1.4",
		date: "Jan 22, 2026",
		tag: "Patch",
		tagVariant: "destructive",
		description: "Resolved a memory leak in the dashboard widgets, patched a security vulnerability in file uploads.",
	},
	{
		version: "v3.1.0",
		date: "Jan 10, 2026",
		tag: "Minor",
		tagVariant: "info",
		description: "Introduced API rate limiting dashboard, added webhook retry configuration, and new audit log filters.",
	},
	{
		version: "v3.0.0",
		date: "Dec 15, 2025",
		tag: "Major",
		tagVariant: "warning",
		description: "Complete UI redesign with new component library, migrated to edge runtime, and added multi-tenant workspace support.",
	},
];

const FIRST_INDEX = 0;
const LAST_INDEX = releases.length - 1;

export function HoverCard8Example(): React.JSX.Element {
	const [current, setCurrent] = useState(FIRST_INDEX);

	const handleNext = useCallback((): void => {
		setCurrent((index: number): number => Math.min(index + 1, LAST_INDEX));
	}, []);

	const handlePrev = useCallback((): void => {
		setCurrent((index: number): number => Math.max(index - 1, FIRST_INDEX));
	}, []);

	const isFirst = current === FIRST_INDEX;
	const isLast = current === LAST_INDEX;
	const release = releases.at(current) ?? LATEST_RELEASE;

	return (
		<div className="flex min-h-[100px] items-center justify-center">
			<HoverCard>
				<HoverCardTrigger delay={100} closeDelay={200} className="cursor-default text-sm font-medium text-primary underline decoration-dashed decoration-1 underline-offset-4">
					What&apos;s new?
				</HoverCardTrigger>
				<HoverCardContent className="w-72 space-y-1 px-3 pt-3 pb-2">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="font-semibold">{release.version}</span>
							<Badge variant={release.tagVariant} size="xs">
								{release.tag}
							</Badge>
						</div>
						<span className="text-muted-foreground">{release.date}</span>
					</div>
					<p className="leading-relaxed text-muted-foreground">{release.description}</p>
					<div className="flex items-center justify-between">
						<div className="flex gap-1">
							{releases.map((item: Release): React.JSX.Element => (
								<span key={item.version} className={cn("size-1.5 rounded-full transition-colors", item === release ? "bg-primary" : "bg-muted-foreground/30")} />
							))}
						</div>
						<div className="flex gap-0.5">
							<Button aria-label="Previous release" className="size-6" disabled={isFirst} onClick={handlePrev} size="icon" variant="ghost">
								<ArrowLeftIcon className="size-3.5" aria-hidden="true" />
							</Button>
							<Button aria-label="Next release" className="size-6" disabled={isLast} onClick={handleNext} size="icon" variant="ghost">
								<ArrowRightIcon className="size-3.5" aria-hidden="true" />
							</Button>
						</div>
					</div>
				</HoverCardContent>
			</HoverCard>
		</div>
	);
}
