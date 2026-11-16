import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Cascader, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderTrigger } from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNodeBase } from "@workspace/ui/components/cascader/cascader-types";

/** Region, country, city: a tree people walk down. */
const PLACES: readonly CascaderNodeBase[] = [
	{
		value: "europe",
		label: "Europe",
		children: [
			{
				value: "fr",
				label: "France",
				children: [
					{ value: "paris", label: "Paris" },
					{ value: "lyon", label: "Lyon" },
				],
			},
			{ value: "de", label: "Germany", children: [{ value: "berlin", label: "Berlin" }] },
		],
	},
	{ value: "asia", label: "Asia", children: [{ value: "my", label: "Malaysia", children: [{ value: "kl", label: "Kuala Lumpur" }] }] },
];

export function CascaderDo1Example(): React.JSX.Element {
	const [value, setValue] = React.useState("paris");
	return (
		<Cascader items={PLACES} value={value} onValueChange={setValue}>
			<CascaderTrigger aria-label="Office" render={<Button variant="outline" className="w-64 justify-between font-normal" />}>
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
