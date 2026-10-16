import * as React from "react";
import { ChevronFirstIcon, ChevronLastIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@workspace/ui/components/pagination";
import { PAGINATION_SAMPLE_HREF } from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination12Example(): React.JSX.Element {
	return (
		<Pagination>
			<PaginationContent className="w-full justify-between">
				<PaginationItem className="flex items-center gap-2">
					<span className="text-sm whitespace-nowrap text-muted-foreground">Rows per page</span>
					<NativeSelect className="w-18" defaultValue="25">
						<NativeSelectOption value="10">10</NativeSelectOption>
						<NativeSelectOption value="25">25</NativeSelectOption>
						<NativeSelectOption value="50">50</NativeSelectOption>
						<NativeSelectOption value="100">100</NativeSelectOption>
					</NativeSelect>
				</PaginationItem>
				<PaginationItem className="flex items-center gap-3">
					<span className="text-sm whitespace-nowrap text-muted-foreground">1-25 of 100</span>
					<div className="flex gap-1">
						<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to first page">
							<ChevronFirstIcon className="size-4" />
						</PaginationLink>
						<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to previous page">
							<ChevronLeftIcon className="size-4" />
						</PaginationLink>
						<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to next page">
							<ChevronRightIcon className="size-4" />
						</PaginationLink>
						<PaginationLink href={PAGINATION_SAMPLE_HREF} size="icon" aria-label="Go to last page">
							<ChevronLastIcon className="size-4" />
						</PaginationLink>
					</div>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
