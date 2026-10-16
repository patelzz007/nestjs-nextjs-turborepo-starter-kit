"use client";

import * as React from "react";
import { useCallback, useState } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable";

/** Each panel's starting share of the group, in percent. */
const LEFT_DEFAULT_SIZE = 30;
const RIGHT_DEFAULT_SIZE = 70;
const DEFAULT_LAYOUT: Readonly<Record<string, number>> = { left: LEFT_DEFAULT_SIZE, right: RIGHT_DEFAULT_SIZE };

export function Resizable10Example(): React.JSX.Element {
	const [sizes, setSizes] = useState<Readonly<Record<string, number>>>(DEFAULT_LAYOUT);

	const handleLayoutChange = useCallback((layout: Readonly<Record<string, number>>): void => {
		setSizes(layout);
	}, []);

	return (
		<div className="mx-auto w-full max-w-lg">
			<ResizablePanelGroup orientation="horizontal" className="min-h-[200px] rounded-2xl border" onLayoutChange={handleLayoutChange}>
				<ResizablePanel id="left" defaultSize={LEFT_DEFAULT_SIZE} minSize={20}>
					<div className="flex h-full flex-col items-center justify-center gap-2 p-6">
						<span className="text-sm font-semibold">{Math.round(sizes.left ?? LEFT_DEFAULT_SIZE)}%</span>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel id="right" defaultSize={RIGHT_DEFAULT_SIZE} minSize={30}>
					<div className="flex h-full flex-col items-center justify-center gap-2 p-6">
						<span className="text-sm font-semibold">{Math.round(sizes.right ?? RIGHT_DEFAULT_SIZE)}%</span>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
