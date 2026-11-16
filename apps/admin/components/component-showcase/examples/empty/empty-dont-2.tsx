import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";

export function EmptyDont2Example(): React.JSX.Element {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>No invoices yet</EmptyTitle>
				<EmptyDescription>Invoices you send show up here.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button>Create invoice</Button>
			</EmptyContent>
		</Empty>
	);
}
