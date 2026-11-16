import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";

export function CollapsibleDont1Example(): React.JSX.Element {
	return (
		<Collapsible className="flex w-full max-w-xs flex-col gap-2">
			<CollapsibleTrigger render={<Button variant="outline" size="sm" className="self-start" />}>More</CollapsibleTrigger>
			<CollapsibleContent className="rounded-lg border px-3 py-2 text-sm">
				<p className="font-medium">Shipping address</p>
				<p className="text-muted-foreground">100 Market St, San Francisco</p>
			</CollapsibleContent>
		</Collapsible>
	);
}
