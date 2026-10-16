import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@workspace/ui/components/pagination";
import { PAGINATION_SAMPLE_HREF } from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination7Example(): React.JSX.Element {
	return (
		<Pagination className="w-full max-w-xs">
			<PaginationContent className="w-full justify-between">
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} size="default" className="gap-2">
						<ArrowLeftIcon className="size-4" />
						Previous
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} size="default" className="gap-2">
						Next
						<ArrowRightIcon className="size-4" />
					</PaginationLink>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
