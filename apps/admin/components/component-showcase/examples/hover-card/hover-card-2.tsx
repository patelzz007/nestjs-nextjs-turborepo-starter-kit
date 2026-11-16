import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";

type Side = NonNullable<React.ComponentProps<typeof HoverCardContent>["side"]>;

const sides: readonly Side[] = ["inline-start", "left", "top", "bottom", "right", "inline-end"];

export function HoverCard2Example(): React.JSX.Element {
	return (
		<div className="grid grid-cols-3 gap-2">
			{sides.map((side: Side): React.JSX.Element => (
				<HoverCard key={side}>
					<HoverCardTrigger delay={100} closeDelay={100} render={<Button variant="outline" className="flex-1 capitalize" />}>
						{side.replace("-", " ")}
					</HoverCardTrigger>

					<HoverCardContent side={side}>
						<div className="flex flex-col gap-1">
							<h4 className="font-medium">Hover Card</h4>
							<p className="text-muted-foreground">This hover card appears on the {side.replace("-", " ")} side of the trigger.</p>
						</div>
					</HoverCardContent>
				</HoverCard>
			))}
		</div>
	);
}
