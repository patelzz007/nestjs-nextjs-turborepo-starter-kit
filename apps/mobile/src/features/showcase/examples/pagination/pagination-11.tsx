import { Pagination } from "@workspace/ui-native/components/pagination";
import * as React from "react";

export function Pagination11Example(): React.JSX.Element {
	const [page, setPage] = React.useState(2);
	return <Pagination page={page} pageCount={5} onChange={setPage} pages="numbers" arrows="icons" variant="strip" />;
}
