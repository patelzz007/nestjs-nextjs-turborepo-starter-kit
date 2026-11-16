import * as React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable";

export function Resizable4Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-lg">
			<ResizablePanelGroup orientation="horizontal" className="min-h-[300px] rounded-2xl border">
				<ResizablePanel defaultSize="50%">
					<div className="flex h-[200px] items-center justify-center p-6">
						<span className="font-semibold">One</span>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize="50%">
					<ResizablePanelGroup orientation="vertical">
						<ResizablePanel defaultSize="25%">
							<div className="flex h-full items-center justify-center p-6">
								<span className="font-semibold">Two</span>
							</div>
						</ResizablePanel>
						<ResizableHandle withHandle />
						<ResizablePanel defaultSize="75%">
							<div className="flex h-full items-center justify-center p-6">
								<span className="font-semibold">Three</span>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
