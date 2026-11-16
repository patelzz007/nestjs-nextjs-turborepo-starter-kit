import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { Badge } from "@workspace/ui/components/badge";

export function CollapsibleDo2Example(): React.JSX.Element {
	return (
		<Collapsible className="flex w-full max-w-xs flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-semibold">Order #4189</span>
				<Badge variant="success-light">Shipped today</Badge>
			</div>
			<CollapsibleTrigger render={<Button variant="ghost" size="sm" className="self-start" />}>Show shipping address</CollapsibleTrigger>
			<CollapsibleContent className="rounded-lg border px-3 py-2 text-sm">
				<p className="font-medium">Shipping address</p>
				<p className="text-muted-foreground">100 Market St, San Francisco</p>
			</CollapsibleContent>
		</Collapsible>
	);
}
