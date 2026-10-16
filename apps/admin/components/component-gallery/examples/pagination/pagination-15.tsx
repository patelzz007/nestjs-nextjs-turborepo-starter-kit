import * as React from "react";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@workspace/ui/components/pagination";
import {
	PAGINATION_SAMPLE_HREF,
	PAGINATION_PREVIOUS_TEXT,
	PAGINATION_NEXT_TEXT,
	PAGINATION_MORE_PAGES_LABEL,
	PAGINATION_PREVIOUS_LABELS,
	PAGINATION_NEXT_LABELS,
} from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination15Example(): React.JSX.Element {
	return (
		<Pagination>
			<PaginationContent className="w-full justify-between">
				<PaginationItem>
					<span className="text-sm text-muted-foreground">
						Page <span className="font-medium text-foreground">1</span> of <span className="font-medium text-foreground">10</span>
					</span>
				</PaginationItem>
				<PaginationItem className="flex items-center gap-1">
					<PaginationPrevious href={PAGINATION_SAMPLE_HREF} text={PAGINATION_PREVIOUS_TEXT} labels={PAGINATION_PREVIOUS_LABELS} />
					<PaginationLink href={PAGINATION_SAMPLE_HREF} isActive>
						1
					</PaginationLink>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>2</PaginationLink>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>3</PaginationLink>
					<PaginationLink href={PAGINATION_SAMPLE_HREF}>4</PaginationLink>
					<PaginationEllipsis morePagesLabel={PAGINATION_MORE_PAGES_LABEL} />
					<PaginationNext href={PAGINATION_SAMPLE_HREF} text={PAGINATION_NEXT_TEXT} labels={PAGINATION_NEXT_LABELS} />
				</PaginationItem>
				<PaginationItem>
					<NativeSelect className="w-28">
						<NativeSelectOption value="10">10 / page</NativeSelectOption>
						<NativeSelectOption value="20">20 / page</NativeSelectOption>
						<NativeSelectOption value="50">50 / page</NativeSelectOption>
						<NativeSelectOption value="100">100 / page</NativeSelectOption>
					</NativeSelect>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
