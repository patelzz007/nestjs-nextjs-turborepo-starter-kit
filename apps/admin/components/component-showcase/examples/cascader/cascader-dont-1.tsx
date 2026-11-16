import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Cascader, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderTrigger } from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNodeBase } from "@workspace/ui/components/cascader/cascader-types";

/** Three flat options: no tree at all. */
const SIZES: readonly CascaderNodeBase[] = [
	{ value: "s", label: "Small" },
	{ value: "m", label: "Medium" },
	{ value: "l", label: "Large" },
];

export function CascaderDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState("");
	return (
		<Cascader items={SIZES} value={value} onValueChange={setValue}>
			<CascaderTrigger aria-label="Size" render={<Button variant="outline" className="w-64 justify-between font-normal" />}>
				<CascaderValue placeholder="Choose" maxSegments={3} />
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
