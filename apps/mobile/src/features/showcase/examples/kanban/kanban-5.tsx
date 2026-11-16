import type { KanbanValue } from "@workspace/ui-kit-logic";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import { Icon } from "@workspace/ui-native/components/icon";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle } from "@workspace/ui-native/components/kanban";
import { Progress } from "@workspace/ui-native/components/progress";
import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import * as React from "react";
import { Text, View } from "react-native";

import { GRIP } from "./kanban-sample";

interface Feature {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	/** Percent built, 0 to 100. */
	readonly progress: number;
	readonly votes: number;
}

type Stage = "planned" | "building" | "shipped";

/** Each stage's dot, in the web example's palette. */
const STAGE_DOT_CLASSES: Readonly<Record<Stage, string>> = {
	planned: "size-2 rounded-full bg-tone-blue",
	building: "size-2 rounded-full bg-tone-yellow",
	shipped: "size-2 rounded-full bg-tone-green",
};

const STAGES: Readonly<Record<string, { readonly title: string; readonly stage: Stage }>> = {
	planned: { title: "Planned", stage: "planned" },
	building: { title: "Building", stage: "building" },
	shipped: { title: "Shipped", stage: "shipped" },
};

const ROADMAP: Readonly<Record<string, readonly Feature[]>> = {
	planned: [
		{ id: "1", title: "AI-powered search", description: "Natural language search across all content", progress: 0, votes: 142 },
		{ id: "2", title: "Custom webhooks", description: "User-configurable webhook endpoints", progress: 0, votes: 98 },
	],
	building: [
		{ id: "3", title: "Real-time collaboration", description: "Multi-user editing with presence indicators", progress: 65, votes: 234 },
		{ id: "4", title: "API v2 migration", description: "RESTful API with OpenAPI 3.0 spec", progress: 40, votes: 176 },
	],
	shipped: [
		{ id: "5", title: "Dark mode", description: "System-aware theme with manual override", progress: 100, votes: 456 },
		{ id: "6", title: "Export to CSV", description: "Bulk data export with custom fields", progress: 100, votes: 189 },
	],
};

function idOf(feature: Feature): string {
	return feature.id;
}

/** A feature: what it is, how far along, and how many asked for it. */
function FeatureCard({ feature }: { readonly feature: Feature }): React.JSX.Element {
	const complete = `${String(feature.progress)}% complete`;
	const votes = String(feature.votes);
	return (
		<KanbanItem value={feature.id} label={feature.title}>
			<Frame variant="ghost" spacing="sm" className="p-0">
				<FramePanel className="gap-2.5 p-3">
					<View className="flex-row items-center gap-1">
						<KanbanItemHandle className="min-h-8 min-w-8">{GRIP}</KanbanItemHandle>
						<Text numberOfLines={1} className="text-label font-sans-medium flex-1 text-foreground">
							{feature.title}
						</Text>
					</View>
					<Text numberOfLines={2} className="text-caption font-sans text-muted-foreground">
						{feature.description}
					</Text>
					<Progress value={feature.progress} accessibilityLabel={`${feature.title} progress`} />
					<View className="flex-row items-center justify-between">
						<Text className="text-overline font-sans text-muted-foreground tabular-nums">{complete}</Text>
						<View accessible accessibilityLabel={`${votes} votes`} className="flex-row items-center gap-1">
							<Icon icon={ArrowUpIcon} size="xs" colorClassName="accent-muted-foreground" />
							<Text className="text-caption font-sans text-muted-foreground tabular-nums">{votes}</Text>
						</View>
					</View>
				</FramePanel>
			</Frame>
		</KanbanItem>
	);
}

// A feature roadmap: stages with a coloured dot, cards with progress and votes.
export function Kanban5Example(): React.JSX.Element {
	const [columns, setColumns] = React.useState<KanbanValue<Feature>>(() =>
		Object.fromEntries(Object.entries(ROADMAP).map(([key, features]): [string, Feature[]] => [key, [...features]])),
	);
	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={idOf}>
			<KanbanBoard>
				{Object.entries(columns).map(([column, features]: [string, Feature[]]): React.JSX.Element => {
					const meta = STAGES[column] ?? { title: column, stage: "planned" };
					return (
						<KanbanColumn key={column} value={column} label={meta.title} className="w-64 border-0 bg-transparent p-0">
							<Frame spacing="sm">
								<FrameHeader className="flex-row items-center gap-2">
									<View className={STAGE_DOT_CLASSES[meta.stage]} />
									<FrameTitle>{meta.title}</FrameTitle>
									<Text className="text-caption font-sans text-muted-foreground tabular-nums">{String(features.length)}</Text>
								</FrameHeader>
								<KanbanColumnContent className="p-0.5">
									{features.map((feature: Feature): React.JSX.Element => (
										<FeatureCard key={feature.id} feature={feature} />
									))}
								</KanbanColumnContent>
							</Frame>
						</KanbanColumn>
					);
				})}
			</KanbanBoard>
		</Kanban>
	);
}
