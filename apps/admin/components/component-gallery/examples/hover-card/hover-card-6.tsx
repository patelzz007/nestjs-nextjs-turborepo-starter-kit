import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card";

export function HoverCard6Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Dialog>
				<DialogTrigger render={<Button variant="outline" />}>Open Dialog</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Hover Card Example</DialogTitle>
						<DialogDescription>Hover over the button below to see the hover card.</DialogDescription>
					</DialogHeader>
					<HoverCard>
						<HoverCardTrigger delay={100} closeDelay={100} render={<Button variant="outline" className="w-fit" />}>
							Hover me
						</HoverCardTrigger>
						<HoverCardContent>
							<div className="flex flex-col gap-1">
								<h4 className="font-medium">Hover Card</h4>
								<p className="text-muted-foreground">This hover card appears inside a dialog. Hover over the button to see it.</p>
							</div>
						</HoverCardContent>
					</HoverCard>
				</DialogContent>
			</Dialog>
		</div>
	);
}
