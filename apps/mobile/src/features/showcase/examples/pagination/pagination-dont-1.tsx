import { Pagination } from "@workspace/ui-native/components/pagination";
import * as React from "react";

export function PaginationDont1Example(): React.JSX.Element {
	const [page, setPage] = React.useState(20);
	return <Pagination page={page} pageCount={40} onChange={setPage} pages="numbers" siblingCount={4} boundaryCount={3} />;
}
