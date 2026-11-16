import { Card, CardContent } from "@workspace/ui-native/components/card";
import { Pagination } from "@workspace/ui-native/components/pagination";
import * as React from "react";

/** How many pages the list has. */
const PAGE_COUNT = 12;

export function Pagination6Example(): React.JSX.Element {
	const [page, setPage] = React.useState(1);
	return (
		<Card>
			<CardContent>
				<Pagination
					page={page}
					pageCount={PAGE_COUNT}
					onChange={setPage}
					pages="numbers"
					arrows="icons"
					pageShape="circle"
					filledCurrent
					boundaryCount={3}
					siblingCount={0}
					size="sm"
				/>
			</CardContent>
		</Card>
	);
}
