import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Cascader } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { View } from "react-native";

/** How long the made-up server takes to answer. */
const LATENCY_MS = 600;

const REPOSITORIES: readonly CascaderNode[] = [
	{ value: "web", label: "acme/web", hasChildren: true },
	{ value: "api", label: "acme/api", hasChildren: true },
];

const TONES: Readonly<Record<string, BadgeTone>> = { stable: "success", beta: "warning", asset: "info" };

/** A made-up server: a repository's releases, a release's assets. */
function childrenOf(node: CascaderNode): readonly CascaderNode[] {
	if (node.value.includes("@")) {
		return [
			{ value: `${node.value}/linux`, label: "app-linux.tar.gz", keywords: ["asset"] },
			{ value: `${node.value}/mac`, label: "app-macos.zip", keywords: ["asset"] },
		];
	}
	return [
		{ value: `${node.value}@2.1.0`, label: "v2.1.0", hasChildren: true, keywords: ["stable"] },
		{ value: `${node.value}@2.2.0-beta`, label: "v2.2.0-beta", hasChildren: true, keywords: ["beta"] },
	];
}

/** The row's tone badge, from its kind. */
function KindBadge(node: CascaderNode): React.ReactNode {
	const [kind] = node.keywords ?? [];
	return kind === undefined ? null : <Badge label={kind} tone={TONES[kind] ?? "neutral"} size="sm" />;
}

export function Cascader15Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	const [failNext, setFailNext] = React.useState(false);
	const load = React.useCallback(
		(node: CascaderNode): Promise<readonly CascaderNode[]> =>
			new Promise((resolve: (children: readonly CascaderNode[]) => void, reject: (error: Error) => void): void => {
				setTimeout((): void => {
					if (failNext) {
						setFailNext(false);
						reject(new Error("The server did not answer."));
						return;
					}
					resolve(childrenOf(node));
				}, LATENCY_MS);
			}),
		[failNext],
	);
	const armFailure = React.useCallback((): void => {
		setFailNext(true);
	}, []);
	return (
		<View className="gap-3">
			<Cascader label="Release asset" items={REPOSITORIES} value={value} onChange={setValue} getChildren={load} renderTrailing={KindBadge} placeholder="Pick an asset" />
			<Button label={failNext ? "The next request will fail" : "Fail the next request"} variant="outline" size="sm" onPress={armFailure} disabled={failNext} />
		</View>
	);
}
