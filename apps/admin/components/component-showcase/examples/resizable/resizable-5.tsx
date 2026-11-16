"use client";

import * as React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable";

export function Resizable5Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-lg">
			<ResizablePanelGroup orientation="horizontal" className="min-h-[200px] rounded-2xl border">
				<ResizablePanel defaultSize={30}>
					<div className="flex h-full items-center justify-center p-6">
						<span className="text-sm font-semibold">Sidebar</span>
					</div>
				</ResizablePanel>
				<ResizableHandle className="before:pointer-events-none before:absolute before:top-1/2 before:left-1/2 before:z-10 before:h-6 before:w-1 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-muted-foreground/25 before:transition-all before:duration-300 before:ease-[cubic-bezier(0.32,0.72,0,1)] hover:before:h-8 hover:before:bg-muted-foreground/50 active:before:h-12 active:before:w-1.5 active:before:bg-primary" />
				<ResizablePanel defaultSize={70}>
					<div className="flex h-full items-center justify-center p-6">
						<span className="text-sm font-semibold">Content</span>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
