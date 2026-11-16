import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Cascader, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderTrigger } from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNodeBase } from "@workspace/ui/components/cascader/cascader-types";

/** Two folders that each hold a page.tsx. */
const FILES: readonly CascaderNodeBase[] = [
	{ value: "app", label: "app", children: [{ value: "app/page", label: "page.tsx" }] },
	{ value: "settings", label: "settings", children: [{ value: "settings/page", label: "page.tsx" }] },
];

export function CascaderDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState("settings/page");
	return (
		<Cascader items={FILES} value={value} onValueChange={setValue}>
			<CascaderTrigger aria-label="Page" render={<Button variant="outline" className="w-64 justify-between font-normal" />}>
				<CascaderValue placeholder="Choose" maxSegments={1} />
			</CascaderTrigger>
			<CascaderContent className="w-72">
				<CascaderPanel>
					<CascaderBreadcrumb />
					<CascaderEmpty />
					<CascaderList>
						<CascaderItems />
					</CascaderList>
				</CascaderPanel>
			</CascaderContent>
		</Cascader>
	);
}
