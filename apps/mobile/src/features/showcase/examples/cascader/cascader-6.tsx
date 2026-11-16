import { Cascader } from "@workspace/ui-native/components/cascader";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import type { CascaderCollapse, CascaderNode, CascaderValueDisplay } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text, View } from "react-native";

const APPS: readonly CascaderNode[] = [
	{
		value: "acme",
		label: "Acme",
		children: [
			{
				value: "acme.crm",
				label: "CRM",
				children: [{ value: "acme.crm.contacts", label: "Contacts", children: [{ value: "acme.crm.contacts.email", label: "Email address" }] }],
			},
		],
	},
];

type Style = "collapsed" | "full" | "tail" | "leaf" | "custom";

const STYLES: readonly ToggleGroupOption<Style>[] = [
	{ value: "collapsed", label: "Collapsed" },
	{ value: "full", label: "Full" },
	{ value: "tail", label: "Tail" },
	{ value: "leaf", label: "Leaf" },
	{ value: "custom", label: "Custom" },
];

interface StyleSetup {
	readonly display: CascaderValueDisplay;
	readonly collapse: CascaderCollapse;
}

const SETUPS: Readonly<Record<Style, StyleSetup>> = {
	collapsed: { display: "path", collapse: "middle" },
	full: { display: "path", collapse: "none" },
	tail: { display: "path", collapse: "start" },
	leaf: { display: "leaf", collapse: "none" },
	custom: { display: "path", collapse: "none" },
};

/** Two lines: the field's name, then the app it lives in. */
function TwoLines(paths: readonly (readonly CascaderNode[])[]): React.JSX.Element {
	const [path = []] = paths;
	return (
		<View>
			<Text className="text-body-lg font-sans-medium text-foreground">{path.at(-1)?.label ?? ""}</Text>
			<Text className="text-caption font-sans text-muted-foreground">
				{path
					.slice(0, -1)
					.map((node: CascaderNode): string => node.label)
					.join(" › ")}
			</Text>
		</View>
	);
}

export function Cascader6Example(): React.JSX.Element {
	const [style, setStyle] = React.useState<Style | null>("collapsed");
	const [value, setValue] = React.useState<string | null>("acme.crm.contacts.email");
	const setup = SETUPS[style ?? "collapsed"];
	return (
		<View className="gap-3">
			<ToggleGroup type="single" label="Path style" options={STYLES} value={style} onChange={setStyle} size="sm" variant="outline" />
			<Cascader
				label="Field"
				items={APPS}
				value={value}
				onChange={setValue}
				display={setup.display}
				collapse={setup.collapse}
				renderValue={style === "custom" ? TwoLines : undefined}
			/>
		</View>
	);
}
