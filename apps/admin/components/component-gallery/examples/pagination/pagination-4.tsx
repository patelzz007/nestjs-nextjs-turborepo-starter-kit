import * as React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@workspace/ui/components/pagination";
import {
	PAGINATION_SAMPLE_HREF,
	PAGINATION_PREVIOUS_TEXT,
	PAGINATION_NEXT_TEXT,
	PAGINATION_PREVIOUS_LABELS,
	PAGINATION_NEXT_LABELS,
} from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination4Example(): React.JSX.Element {
	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious href={PAGINATION_SAMPLE_HREF} text={PAGINATION_PREVIOUS_TEXT} labels={PAGINATION_PREVIOUS_LABELS} className="rounded-full" />
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} className="rounded-full">
						1
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} isActive className="rounded-full">
						2
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} className="rounded-full">
						3
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext href={PAGINATION_SAMPLE_HREF} text={PAGINATION_NEXT_TEXT} labels={PAGINATION_NEXT_LABELS} className="rounded-full" />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
