import * as React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable";

export function ResizableDont1Example(): React.JSX.Element {
	return (
		<ResizablePanelGroup orientation="horizontal" className="min-h-40 w-full max-w-md rounded-lg border">
			<ResizablePanel defaultSize="35%" minSize={0}>
				<div className="flex h-full items-center justify-center p-4 text-sm font-medium">Files</div>
			</ResizablePanel>
			<ResizableHandle withHandle />
			<ResizablePanel defaultSize="65%" minSize={0}>
				<div className="flex h-full items-center justify-center p-4 text-sm font-medium">Editor</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
