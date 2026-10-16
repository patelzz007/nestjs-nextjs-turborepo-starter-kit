import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@workspace/ui/components/pagination";
import { PAGINATION_SAMPLE_HREF, PAGINATION_MORE_PAGES_LABEL } from "@/components/component-gallery/examples/pagination/pagination-sample";

/** The page numbers shown before the ellipsis. */
const PAGES: readonly number[] = [1, 2, 3, 4];
const ACTIVE_PAGE = 3;

export function Pagination11Example(): React.JSX.Element {
	return (
		<Pagination>
			<PaginationContent className="gap-0 overflow-hidden rounded-md border">
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to previous page" className="rounded-none border-0 border-e border-border">
						<ChevronLeftIcon />
					</PaginationLink>
				</PaginationItem>

				{PAGES.map((page: number): React.JSX.Element => (
					<PaginationItem key={page}>
						<PaginationLink href={PAGINATION_SAMPLE_HREF} isActive={page === ACTIVE_PAGE} className="rounded-none border-0 border-e border-border data-[active=true]:bg-muted">
							{page}
						</PaginationLink>
					</PaginationItem>
				))}

				<PaginationItem className="border-0 border-e border-border">
					<PaginationEllipsis morePagesLabel={PAGINATION_MORE_PAGES_LABEL} />
				</PaginationItem>

				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to next page" className="rounded-none border-0">
						<ChevronRightIcon />
					</PaginationLink>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
