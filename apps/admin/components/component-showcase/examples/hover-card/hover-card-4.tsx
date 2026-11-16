import * as React from "react";
import { ZapIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";

export function HoverCard4Example(): React.JSX.Element {
	return (
		<div className="flex min-h-[100px] items-center justify-center">
			<HoverCard>
				<HoverCardTrigger delay={100} closeDelay={100} render={<Button variant="outline">Instant Deployment</Button>} />
				<HoverCardContent className="w-80 p-3">
					<div className="flex gap-2">
						<ZapIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tone-yellow" />
						<div className="space-y-1">
							<p className="font-medium">Zero Latency Edge</p>
							<p className="leading-relaxed text-muted-foreground">Deploy your applications across our global edge network in seconds.</p>
						</div>
					</div>
				</HoverCardContent>
			</HoverCard>
		</div>
	);
}
