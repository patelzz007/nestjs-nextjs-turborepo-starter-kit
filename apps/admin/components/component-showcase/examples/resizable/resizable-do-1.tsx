import * as React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable";

export function ResizableDo1Example(): React.JSX.Element {
	return (
		<ResizablePanelGroup orientation="horizontal" className="min-h-40 w-full max-w-md rounded-lg border">
			<ResizablePanel defaultSize="35%" minSize="25%">
				<div className="flex h-full items-center justify-center p-4 text-sm font-medium">Files</div>
			</ResizablePanel>
			<ResizableHandle withHandle />
			<ResizablePanel defaultSize="65%" minSize="40%">
				<div className="flex h-full items-center justify-center p-4 text-sm font-medium">Editor</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
