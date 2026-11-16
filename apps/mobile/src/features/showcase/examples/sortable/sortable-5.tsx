import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import { Switch } from "@workspace/ui-native/components/switch";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

interface Channel {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly enabled: boolean;
}

const CHANNELS: readonly Channel[] = [
	{ id: "1", name: "Email", description: "Send notifications via email", enabled: true },
	{ id: "2", name: "Push Notifications", description: "Browser and mobile push", enabled: true },
	{ id: "3", name: "SMS", description: "Text message alerts", enabled: false },
	{ id: "4", name: "Slack", description: "Post to Slack channels", enabled: true },
	{ id: "5", name: "Webhook", description: "Send to custom endpoint", enabled: false },
];

const TITLE = "Notification Priority";
const DESCRIPTION = "Drag to reorder by priority. Top channels are tried first.";

function getItemValue(channel: Channel): string {
	return channel.id;
}

function ChannelRow({
	channel,
	position,
	onToggle,
}: {
	readonly channel: Channel;
	readonly position: number;
	readonly onToggle: (id: string, enabled: boolean) => void;
}): React.JSX.Element {
	const toggle = React.useCallback(
		(enabled: boolean): void => {
			onToggle(channel.id, enabled);
		},
		[channel.id, onToggle],
	);
	return (
		<View className="flex-row items-center gap-2 rounded-md px-1 py-1">
			<SortableItemHandle>
				<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
			</SortableItemHandle>
			<Text className="text-caption w-4 font-sans text-muted-foreground tabular-nums">{String(position + 1)}</Text>
			<View className="flex-1">
				<Text className="text-label font-sans-medium text-foreground">{channel.name}</Text>
				<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
					{channel.description}
				</Text>
			</View>
			<Switch label={channel.name} hideLabel checked={channel.enabled} onChange={toggle} />
		</View>
	);
}

export function Sortable5Example(): React.JSX.Element {
	const [channels, setChannels] = React.useState<readonly Channel[]>(CHANNELS);
	const toggle = React.useCallback((id: string, enabled: boolean): void => {
		setChannels((current: readonly Channel[]): readonly Channel[] => current.map((channel: Channel): Channel => (channel.id === id ? { ...channel, enabled } : channel)));
	}, []);
	return (
		<Frame>
			<FrameHeader>
				<FrameTitle>{TITLE}</FrameTitle>
				<FrameDescription>{DESCRIPTION}</FrameDescription>
			</FrameHeader>
			<FramePanel className="p-2">
				<Sortable value={channels} onValueChange={setChannels} getItemValue={getItemValue} className="gap-1">
					{channels.map((channel: Channel, position: number): React.JSX.Element => (
						<SortableItem key={channel.id} value={channel.id} label={channel.name}>
							<ChannelRow channel={channel} position={position} onToggle={toggle} />
						</SortableItem>
					))}
				</Sortable>
			</FramePanel>
		</Frame>
	);
}
