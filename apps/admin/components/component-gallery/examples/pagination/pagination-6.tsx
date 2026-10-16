import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@workspace/ui/components/pagination";
import { PAGINATION_SAMPLE_HREF, PAGINATION_MORE_PAGES_LABEL } from "@/components/component-gallery/examples/pagination/pagination-sample";

const LEADING_PAGES: readonly number[] = [1, 2, 3];
const TRAILING_PAGES: readonly number[] = [10, 11, 12];
const ACTIVE_PAGE = 1;

export function Pagination6Example(): React.JSX.Element {
	return (
		<Card className="p-2">
			<CardContent className="p-0">
				<Pagination>
					<PaginationContent>
						{/* Previous */}
						<PaginationItem>
							<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to previous page" className="h-8 w-8 rounded-full hover:bg-muted">
								<ChevronLeftIcon className="size-4" />
							</PaginationLink>
						</PaginationItem>

						{LEADING_PAGES.map((page: number): React.JSX.Element => (
							<PaginationItem key={page}>
								<PaginationLink
									href={PAGINATION_SAMPLE_HREF}
									isActive={page === ACTIVE_PAGE}
									className={page === ACTIVE_PAGE ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-muted"}>
									{page}
								</PaginationLink>
							</PaginationItem>
						))}

						<PaginationItem>
							<PaginationEllipsis morePagesLabel={PAGINATION_MORE_PAGES_LABEL} />
						</PaginationItem>

						{TRAILING_PAGES.map((page: number): React.JSX.Element => (
							<PaginationItem key={page}>
								<PaginationLink href={PAGINATION_SAMPLE_HREF}>{page}</PaginationLink>
							</PaginationItem>
						))}

						{/* Next */}
						<PaginationItem>
							<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to next page" className="h-8 w-8 rounded-full hover:bg-muted">
								<ChevronRightIcon className="size-4" />
							</PaginationLink>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			</CardContent>
		</Card>
	);
}
