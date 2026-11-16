"use client";

import * as React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable";

export function Resizable2Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-lg">
			<ResizablePanelGroup orientation="horizontal" className="min-h-[200px] rounded-2xl border">
				<ResizablePanel defaultSize={25}>
					<div className="flex h-full items-center justify-center p-6">
						<span className="text-sm font-semibold">Sidebar</span>
					</div>
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel defaultSize={75}>
					<div className="flex h-full items-center justify-center p-6">
						<span className="text-sm font-semibold">Content</span>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
