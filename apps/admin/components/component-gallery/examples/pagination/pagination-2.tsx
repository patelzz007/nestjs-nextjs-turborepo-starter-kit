import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@workspace/ui/components/pagination";
import { PAGINATION_SAMPLE_HREF } from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination2Example(): React.JSX.Element {
	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} aria-label="Go to previous page" size="icon">
						<ChevronLeftIcon className="size-4" />
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>1</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} isActive>
						2
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>3</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} aria-label="Go to next page" size="icon">
						<ChevronRightIcon className="size-4" />
					</PaginationLink>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
