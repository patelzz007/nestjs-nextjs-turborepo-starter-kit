import Image from "next/image";
import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";

/** A sample preview from images.unsplash.com (the host `next.config` allows); 16:9 like the frame. */
const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 360;
const PREVIEW_SRC = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=${String(PREVIEW_WIDTH)}&h=${String(PREVIEW_HEIGHT)}&q=80`;

export function HoverCard5Example(): React.JSX.Element {
	return (
		<div className="flex min-h-[100px] items-center justify-center">
			<HoverCard>
				<HoverCardTrigger delay={100} closeDelay={100} render={<Button variant="outline">View Image</Button>} />
				<HoverCardContent className="w-[320px] overflow-hidden p-0">
					<Image src={PREVIEW_SRC} alt="Generated landing page preview" width={PREVIEW_WIDTH} height={PREVIEW_HEIGHT} className="aspect-video w-full object-cover" />
					<div className="space-y-1 p-3">
						<p className="font-medium">Image Overview</p>
						<p className="leading-relaxed text-muted-foreground">Visual overview of generated landing page.</p>
					</div>
				</HoverCardContent>
			</HoverCard>
		</div>
	);
}
