import CheckIcon from "lucide-react-native/icons/check";
import CircleIcon from "lucide-react-native/icons/circle";
import LoaderIcon from "lucide-react-native/icons/loader";
import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui-native/components/collapsible";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { TimelineRailIcon, TimelineRailItem, type TimelineRailTone } from "@workspace/ui-native/components/timeline-rail";
import * as React from "react";
import { Text, View } from "react-native";

interface Stage {
	readonly key: string;
	readonly title: string;
	readonly duration: string;
	readonly status: string;
	readonly badge: BadgeTone;
	readonly icon: LucideIcon;
	readonly tone: TimelineRailTone;
	readonly log: string;
}

const STAGES: readonly Stage[] = [
	{ key: "install", title: "Install", duration: "12s", status: "Passed", badge: "success", icon: CheckIcon, tone: "success", log: "pnpm install --frozen-lockfile" },
	{ key: "build", title: "Build", duration: "48s", status: "Running", badge: "info", icon: LoaderIcon, tone: "attention", log: "next build" },
	{ key: "deploy", title: "Deploy", duration: "—", status: "Queued", badge: "neutral", icon: CircleIcon, tone: "neutral", log: "Waiting for build" },
];

function StageRow({ stage, isLast }: { readonly stage: Stage; readonly isLast: boolean }): React.JSX.Element {
	const [open, setOpen] = React.useState(true);
	return (
		<TimelineRailItem node={<TimelineRailIcon icon={stage.icon} tone={stage.tone} size="sm" />} isLast={isLast}>
			<Collapsible open={open} onOpenChange={setOpen} variant="card">
				<CollapsibleTrigger label={stage.title} trailing={<Badge label={`${stage.status} · ${stage.duration}`} tone={stage.badge} size="sm" />} />
				<CollapsibleContent>
					<Text className="text-caption font-mono text-muted-foreground">{stage.log}</Text>
				</CollapsibleContent>
			</Collapsible>
		</TimelineRailItem>
	);
}

export function Timeline6Example(): React.JSX.Element {
	return (
		<View>
			{STAGES.map((stage: Stage, index: number): React.JSX.Element => (
				<StageRow key={stage.key} stage={stage} isLast={index === STAGES.length - 1} />
			))}
		</View>
	);
}
