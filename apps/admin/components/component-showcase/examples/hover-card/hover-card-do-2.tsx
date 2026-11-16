import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";

export function HoverCardDo2Example(): React.JSX.Element {
	return (
		<HoverCard>
			<HoverCardTrigger href="#ada" className="text-sm font-medium underline underline-offset-4">
				Ada Lovelace
			</HoverCardTrigger>
			<HoverCardContent>
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">Ada Lovelace</p>
					<p className="text-sm text-muted-foreground">Engineering lead · London</p>
				</div>
			</HoverCardContent>
		</HoverCard>
	);
}
