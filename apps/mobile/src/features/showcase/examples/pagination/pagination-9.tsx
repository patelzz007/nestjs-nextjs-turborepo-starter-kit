import { Pagination } from "@workspace/ui-native/components/pagination";
import * as React from "react";

export function Pagination9Example(): React.JSX.Element {
	const [page, setPage] = React.useState(1);
	return <Pagination page={page} pageCount={10} onChange={setPage} infoPosition="start" arrows="icons" />;
}
