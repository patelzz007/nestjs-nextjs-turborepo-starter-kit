"use client";

import * as React from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@workspace/ui/components/pagination";
import {
	PAGINATION_SAMPLE_HREF,
	PAGINATION_PREVIOUS_TEXT,
	PAGINATION_NEXT_TEXT,
	PAGINATION_PREVIOUS_LABELS,
	PAGINATION_NEXT_LABELS,
} from "@/components/component-gallery/examples/pagination/pagination-sample";

export function Pagination3Example(): React.JSX.Element {
	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious href={PAGINATION_SAMPLE_HREF} text={PAGINATION_PREVIOUS_TEXT} labels={PAGINATION_PREVIOUS_LABELS} />
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} className="hover:border! hover:border-border">
						1
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} isActive>
						2
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href={PAGINATION_SAMPLE_HREF} className="hover:border! hover:border-border">
						3
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext href={PAGINATION_SAMPLE_HREF} text={PAGINATION_NEXT_TEXT} labels={PAGINATION_NEXT_LABELS} />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
