import * as React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@workspace/ui/components/pagination";
import {
	PAGINATION_SAMPLE_HREF,
	PAGINATION_PREVIOUS_TEXT,
	PAGINATION_NEXT_TEXT,
	PAGINATION_PREVIOUS_LABELS,
	PAGINATION_NEXT_LABELS,
} from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination9Example(): React.JSX.Element {
	return (
		<Pagination className="w-full max-w-xs">
			<PaginationContent className="w-full justify-between">
				<PaginationItem>
					<span className="text-xs text-muted-foreground">
						Page <span className="font-medium text-foreground">1</span> of <span className="font-medium text-foreground">10</span>
					</span>
				</PaginationItem>
				<PaginationItem className="flex gap-1">
					<PaginationPrevious href={PAGINATION_SAMPLE_HREF} text={PAGINATION_PREVIOUS_TEXT} labels={PAGINATION_PREVIOUS_LABELS} />
					<PaginationNext href={PAGINATION_SAMPLE_HREF} text={PAGINATION_NEXT_TEXT} labels={PAGINATION_NEXT_LABELS} />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
