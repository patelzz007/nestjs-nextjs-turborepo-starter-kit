import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";

export function EmptyDo2Example(): React.JSX.Element {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>No invoices match “acme 2019”</EmptyTitle>
				<EmptyDescription>Check the spelling, or search for something else.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button variant="outline">Clear search</Button>
			</EmptyContent>
		</Empty>
	);
}
