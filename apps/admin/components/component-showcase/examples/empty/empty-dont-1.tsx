import * as React from "react";
import { Empty, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";

export function EmptyDont1Example(): React.JSX.Element {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>No data.</EmptyTitle>
			</EmptyHeader>
		</Empty>
	);
}
