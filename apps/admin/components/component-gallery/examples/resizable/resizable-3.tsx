"use client";

import * as React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable";

export function Resizable3Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-lg">
			<ResizablePanelGroup orientation="horizontal" className="min-h-[300px] rounded-2xl border">
				<ResizablePanel defaultSize={40}>
					<div className="flex h-full items-center justify-center p-6">
						<span className="text-sm font-semibold">Side</span>
					</div>
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel defaultSize={60}>
					<ResizablePanelGroup orientation="vertical">
						<ResizablePanel defaultSize={30}>
							<div className="flex h-full items-center justify-center p-6">
								<span className="text-sm font-semibold">Top</span>
							</div>
						</ResizablePanel>
						<ResizableHandle />
						<ResizablePanel defaultSize={70}>
							<div className="flex h-full items-center justify-center p-6">
								<span className="text-sm font-semibold">Bottom</span>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
