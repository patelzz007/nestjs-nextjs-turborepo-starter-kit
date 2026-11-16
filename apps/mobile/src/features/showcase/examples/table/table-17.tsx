import { Badge } from "@workspace/ui-native/components/badge";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import { Progress } from "@workspace/ui-native/components/progress";
import { PulseDot } from "@workspace/ui-native/components/pulse-dot";
import * as React from "react";
import { Text, View } from "react-native";

import { DetailRow } from "./table-sample";

const TITLE = "Droplet Status";
const DESCRIPTION = "Primary production server";
const CPU_PERCENT = 42;
const MEMORY_PERCENT = 67;
const TAGS: readonly string[] = ["production", "api", "critical"];

export function Table17Example(): React.JSX.Element {
	return (
		<Frame spacing="sm">
			<FrameHeader className="gap-1 px-2">
				<FrameTitle>{TITLE}</FrameTitle>
				<View className="flex-row flex-wrap items-center gap-1.5">
					<FrameDescription>{DESCRIPTION}</FrameDescription>
					<Badge label="prod-api-us-east-1" variant="outline" size="sm" />
				</View>
			</FrameHeader>
			<FramePanel className="p-0">
				<DetailRow label="Status">
					<View className="flex-row items-center gap-2">
						<PulseDot tone="success" />
						<Text className="text-label font-sans-medium text-success-foreground">Operational</Text>
					</View>
				</DetailRow>
				<DetailRow label="Instance Type">
					<Text className="text-label font-code text-foreground">c6g.2xlarge</Text>
				</DetailRow>
				<DetailRow label="Region">
					<Text className="text-label font-sans text-foreground">US East (N. Virginia)</Text>
				</DetailRow>
				<DetailRow label="CPU Usage">
					<View className="flex-row items-center gap-3">
						<Progress value={CPU_PERCENT} accessibilityLabel="CPU usage" className="w-24" />
						<Text className="text-label font-sans text-muted-foreground">{`${String(CPU_PERCENT)}%`}</Text>
					</View>
				</DetailRow>
				<DetailRow label="Memory">
					<View className="flex-row items-center gap-3">
						<Progress value={MEMORY_PERCENT} variant="warning" accessibilityLabel="Memory used" className="w-24" />
						<Text className="text-label font-sans text-muted-foreground">10.7 / 16 GB</Text>
					</View>
				</DetailRow>
				<DetailRow label="Uptime">
					<Text className="text-label font-sans text-foreground">47 days, 12 hours</Text>
				</DetailRow>
				<DetailRow label="OS">
					<Text className="text-label font-sans text-foreground">Amazon Linux 2023</Text>
				</DetailRow>
				<DetailRow label="Tags" last>
					<View className="flex-row flex-wrap gap-1.5">
						{TAGS.map((tag: string): React.JSX.Element => (
							<Badge key={tag} label={tag} size="sm" />
						))}
					</View>
				</DetailRow>
			</FramePanel>
		</Frame>
	);
}
