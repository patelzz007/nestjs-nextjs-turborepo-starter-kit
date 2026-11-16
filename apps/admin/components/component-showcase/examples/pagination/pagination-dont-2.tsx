import * as React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@workspace/ui/components/pagination";

import {
	PAGINATION_NEXT_LABELS,
	PAGINATION_NEXT_TEXT,
	PAGINATION_PREVIOUS_LABELS,
	PAGINATION_PREVIOUS_TEXT,
	PAGINATION_SAMPLE_HREF,
} from "@/components/component-showcase/examples/pagination/pagination-sample";

export function PaginationDont2Example(): React.JSX.Element {
	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious href={PAGINATION_SAMPLE_HREF} text={PAGINATION_PREVIOUS_TEXT} labels={PAGINATION_PREVIOUS_LABELS} />
				</PaginationItem>
				<PaginationItem>
					<PaginationNext href={PAGINATION_SAMPLE_HREF} text={PAGINATION_NEXT_TEXT} labels={PAGINATION_NEXT_LABELS} />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
