import * as React from "react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@workspace/ui/components/pagination";
import {
	PAGINATION_SAMPLE_HREF,
	PAGINATION_PREVIOUS_TEXT,
	PAGINATION_NEXT_TEXT,
	PAGINATION_MORE_PAGES_LABEL,
	PAGINATION_PREVIOUS_LABELS,
	PAGINATION_NEXT_LABELS,
} from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination10Example(): React.JSX.Element {
	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious href={PAGINATION_SAMPLE_HREF} text={PAGINATION_PREVIOUS_TEXT} labels={PAGINATION_PREVIOUS_LABELS} />
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} isActive>
						1
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>2</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>3</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>4</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationEllipsis morePagesLabel={PAGINATION_MORE_PAGES_LABEL} />
				</PaginationItem>
				<PaginationItem>
					<PaginationNext href={PAGINATION_SAMPLE_HREF} text={PAGINATION_NEXT_TEXT} labels={PAGINATION_NEXT_LABELS} />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
