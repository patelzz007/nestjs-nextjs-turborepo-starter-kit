import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { type CascaderLabels, CascaderPanel } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text } from "react-native";

const TITLE = "Documentation";
const LABELS: Partial<CascaderLabels> = { search: "Search the docs" };

const CONTENTS: readonly CascaderNode[] = [
	{
		value: "start",
		label: "Getting started",
		children: [
			{ value: "start.install", label: "Installation" },
			{ value: "start.config", label: "Configuration" },
		],
	},
	{
		value: "guides",
		label: "Guides",
		children: [
			{
				value: "guides.auth",
				label: "Authentication",
				children: [
					{ value: "guides.auth.sso", label: "Single sign-on" },
					{ value: "guides.auth.mfa", label: "Two-factor sign-in" },
				],
			},
			{ value: "guides.deploy", label: "Deploying" },
		],
	},
	{
		value: "api",
		label: "API reference",
		children: [
			{ value: "api.rest", label: "REST" },
			{ value: "api.webhooks", label: "Webhooks" },
		],
	},
];

export function Cascader7Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{TITLE}</CardTitle>
			</CardHeader>
			<CardContent className="gap-2">
				<CascaderPanel items={CONTENTS} value={value} onChange={setValue} listSize="sm" labels={LABELS} />
				<Text className="text-body font-sans text-muted-foreground">{value === null ? "Pick a page." : `Reading ${value}`}</Text>
			</CardContent>
		</Card>
	);
}
