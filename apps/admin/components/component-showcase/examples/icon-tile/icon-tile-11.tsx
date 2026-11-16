import * as React from "react";
import { LayoutDashboardIcon } from "lucide-react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";
import { IconTile } from "@workspace/ui/components/icon-tile";

export function IconTile11Example(): React.JSX.Element {
	return (
		<Frame className="w-full max-w-xs">
			<FramePanel className="flex flex-col gap-3">
				<IconTile tone="brand" variant="elevated" size="lg" aria-hidden="true">
					<LayoutDashboardIcon />
				</IconTile>
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-medium">Unified dashboard</h3>
					<p className="text-xs text-muted-foreground">Track every project, deployment and metric from a single workspace.</p>
				</div>
			</FramePanel>
		</Frame>
	);
}
