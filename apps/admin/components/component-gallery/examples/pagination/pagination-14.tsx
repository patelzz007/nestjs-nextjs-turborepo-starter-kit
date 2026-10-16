import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from "@workspace/ui/components/pagination";
import { PAGINATION_SAMPLE_HREF, PAGINATION_MORE_PAGES_LABEL } from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination14Example(): React.JSX.Element {
	return (
		<Pagination>
			<PaginationContent className="w-full justify-between">
				<PaginationItem className="flex items-center gap-1">
					<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to previous page">
						<ChevronLeftIcon className="size-4" />
					</PaginationLink>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} isActive>
						1
					</PaginationLink>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>2</PaginationLink>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>3</PaginationLink>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>4</PaginationLink>
					<PaginationEllipsis morePagesLabel={PAGINATION_MORE_PAGES_LABEL} />
					<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to next page">
						<ChevronRightIcon className="size-4" />
					</PaginationLink>
				</PaginationItem>
				<PaginationItem className="flex items-center gap-2">
					<span className="text-sm whitespace-nowrap text-muted-foreground">Go to page</span>
					<Input type="number" min={1} max={10} defaultValue={1} className="h-9 w-16 text-center" />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
