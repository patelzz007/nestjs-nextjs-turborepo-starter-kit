"use client";

import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Scrollspy } from "@workspace/ui/components/scrollspy";

interface Section {
	readonly id: string;
	readonly label: string;
}

const SECTIONS: readonly Section[] = [
	{ id: "scrollspy-do-1-1", label: "Overview" },
	{ id: "scrollspy-do-1-2", label: "Installation" },
	{ id: "scrollspy-do-1-3", label: "Usage" },
	{ id: "scrollspy-do-1-4", label: "API" },
];

export function ScrollspyDo1Example(): React.JSX.Element {
	const parentRef = React.useRef<HTMLDivElement | null>(null);
	return (
		<div className="flex w-full max-w-lg gap-4">
			<Scrollspy offset={50} targetRef={parentRef} className="flex w-36 shrink-0 flex-col gap-1.5">
				{SECTIONS.map((section: Section): React.JSX.Element => (
					<Button key={section.id} variant="ghost" size="sm" data-scrollspy-anchor={section.id} className="justify-start data-[active=true]:bg-muted">
						{section.label}
					</Button>
				))}
			</Scrollspy>
			<div className="grow" ref={parentRef}>
				<ScrollArea className="h-64">
					<div className="flex flex-col gap-6 pe-3">
						{SECTIONS.map((section: Section): React.JSX.Element => (
							<section key={section.id} id={section.id} className="flex flex-col gap-2">
								<h4 className="text-sm font-semibold">{section.label}</h4>
								<p className="text-sm text-muted-foreground">What the {section.label.toLowerCase()} section covers, in a short paragraph people can read in place.</p>
							</section>
						))}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}
