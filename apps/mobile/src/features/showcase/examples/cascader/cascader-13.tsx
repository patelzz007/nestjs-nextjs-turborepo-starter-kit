import FilmIcon from "lucide-react-native/icons/film";
import HeadphonesIcon from "lucide-react-native/icons/headphones";
import NewspaperIcon from "lucide-react-native/icons/newspaper";
import { Badge } from "@workspace/ui-native/components/badge";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const RUNTIMES: Readonly<Record<string, string>> = { intro: "4:12", keynote: "48:30", episode1: "32:05", episode2: "29:41", launch: "6 min" };

const LIBRARY: readonly CascaderNode[] = [
	{
		value: "video",
		label: "Video",
		icon: <IconTile icon={FilmIcon} tone="violet" size="sm" />,
		children: [
			{
				value: "talks",
				label: "Talks",
				children: [
					{ value: "intro", label: "Intro to the API" },
					{ value: "keynote", label: "Keynote 2026" },
				],
			},
		],
	},
	{
		value: "audio",
		label: "Audio",
		icon: <IconTile icon={HeadphonesIcon} tone="orange" size="sm" />,
		children: [
			{
				value: "podcast",
				label: "Podcast",
				children: [
					{ value: "episode1", label: "Episode 1" },
					{ value: "episode2", label: "Episode 2" },
				],
			},
		],
	},
	{
		value: "articles",
		label: "Articles",
		icon: <IconTile icon={NewspaperIcon} tone="green" size="sm" />,
		children: [{ value: "blog", label: "Blog", children: [{ value: "launch", label: "Launch post" }] }],
	},
];

/** An item's runtime, after its name. */
function Runtime(node: CascaderNode): React.ReactNode {
	const runtime = RUNTIMES[node.value];
	return runtime === undefined ? null : <Badge label={runtime} size="sm" variant="outline" />;
}

export function Cascader13Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("keynote");
	return <Cascader label="Media" items={LIBRARY} value={value} onChange={setValue} mode="columns" renderTrailing={Runtime} display="leaf" />;
}
