import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@workspace/ui/components/pagination";
import { PAGINATION_SAMPLE_HREF } from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination8Example(): React.JSX.Element {
	return (
		<Pagination className="w-full max-w-xs">
			<PaginationContent className="w-full justify-between">
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to previous page">
						<ChevronLeftIcon className="size-4" />
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<span className="text-xs text-muted-foreground">
						Page <span className="font-medium text-foreground">1</span> of <span className="font-medium text-foreground">10</span>
					</span>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to next page">
						<ChevronRightIcon className="size-4" />
					</PaginationLink>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
