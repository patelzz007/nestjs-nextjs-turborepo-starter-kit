import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { Badge } from "@workspace/ui/components/badge";

export function CollapsibleDont2Example(): React.JSX.Element {
	return (
		<Collapsible className="flex w-full max-w-xs flex-col gap-2">
			<span className="text-sm font-semibold">Order #4189</span>
			<CollapsibleTrigger render={<Button variant="ghost" size="sm" className="self-start" />}>Show details</CollapsibleTrigger>
			<CollapsibleContent className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm">
				<Badge variant="success-light" className="self-start">
					Shipped today
				</Badge>
				<p className="text-muted-foreground">100 Market St, San Francisco</p>
			</CollapsibleContent>
		</Collapsible>
	);
}
