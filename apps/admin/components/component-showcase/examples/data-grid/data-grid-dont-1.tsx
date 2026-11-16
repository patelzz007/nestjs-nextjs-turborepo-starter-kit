import * as React from "react";
import { GuidelineGrid } from "@/components/component-showcase/examples/data-grid/data-grid-guideline-sample";

export function DataGridDont1Example(): React.JSX.Element {
	return <GuidelineGrid pinName={false} formatted />;
}
