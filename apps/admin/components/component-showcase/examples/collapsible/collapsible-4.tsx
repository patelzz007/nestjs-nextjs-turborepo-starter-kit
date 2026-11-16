import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { Progress } from "@workspace/ui/components/progress";

export function Collapsible4Example(): React.JSX.Element {
	return (
		<div className="h-72 w-full max-w-xs">
			<Collapsible className="relative">
				<Card>
					<CardHeader className="flex items-center justify-between">
						<CardTitle className="text-sm">3 days remaining in cycle</CardTitle>
						<CardAction>
							<Button variant="outline" size="sm">
								Billing
							</Button>
						</CardAction>
					</CardHeader>
					<CardContent>
						<div className="space-y-2 rounded-lg border border-border bg-muted/60 p-3">
							<div className="flex justify-between text-sm font-medium">
								<span>$18.08 / $20</span>
								<span>$200</span>
							</div>
							<Progress value={90} className="**:data-[slot=progress-track]:h-1.5 **:data-[slot=progress-track]:bg-primary/20" />
						</div>

						<CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
							<div className="flex flex-col gap-2.5 pt-6">
								{[
									{ label: "Requests", value: "$210.84" },
									{ label: "Active CPU", value: "$21.95" },
									{ label: "Events", value: "$21.20" },
									{ label: "Storage Usage", value: "$20.45" },
								].map((item) => (
									<div key={item.label} className="flex justify-between text-xs">
										<span className="font-medium text-muted-foreground">{item.label}</span>
										<span className="font-medium">{item.value}</span>
									</div>
								))}
							</div>
						</CollapsibleContent>
					</CardContent>
				</Card>

				<div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2">
					<CollapsibleTrigger render={<Button variant="outline" size="icon-sm" className="rounded-full bg-background! shadow-sm" />}>
						<ChevronDownIcon aria-hidden="true" className="size-3.5 transition-transform in-aria-expanded:rotate-180" />
						<span className="sr-only">Toggle details</span>
					</CollapsibleTrigger>
				</div>
			</Collapsible>
		</div>
	);
}
