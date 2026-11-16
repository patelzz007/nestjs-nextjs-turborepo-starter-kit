"use client";

import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import { useState } from "react";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui/components/sortable";

import { Switch } from "@workspace/ui/components/switch";

interface NotificationChannel {
	id: string;
	name: string;
	description: string;
	enabled: boolean;
}

const defaultChannels: NotificationChannel[] = [
	{
		id: "1",
		name: "Email",
		description: "Send notifications via email",
		enabled: true,
	},
	{
		id: "2",
		name: "Push Notifications",
		description: "Browser and mobile push",
		enabled: true,
	},
	{ id: "3", name: "SMS", description: "Text message alerts", enabled: false },
	{
		id: "4",
		name: "Slack",
		description: "Post to Slack channels",
		enabled: true,
	},
	{
		id: "5",
		name: "Webhook",
		description: "Send to custom endpoint",
		enabled: false,
	},
];

function getItemValue(item: NotificationChannel): string {
	return item.id;
}

interface ChannelSwitchProps {
	readonly channel: NotificationChannel;
	readonly onToggle: (id: string) => void;
}

/** One channel's on/off switch; binds the channel id once so the handler stays stable. */
function ChannelSwitch({ channel, onToggle }: ChannelSwitchProps): React.JSX.Element {
	const handleCheckedChange = React.useCallback((): void => {
		onToggle(channel.id);
	}, [channel.id, onToggle]);

	return <Switch checked={channel.enabled} onCheckedChange={handleCheckedChange} aria-label={`Enable ${channel.name}`} />;
}

export function Sortable5Example(): React.JSX.Element {
	const [channels, setChannels] = useState<NotificationChannel[]>(defaultChannels);

	const toggleChannel = React.useCallback((id: string): void => {
		setChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, enabled: !ch.enabled } : ch)));
	}, []);

	return (
		<div className="mx-auto w-full max-w-md">
			<Frame spacing="sm">
				<FrameHeader>
					<FrameTitle>Notification Priority</FrameTitle>
					<FrameDescription>Drag to reorder by priority. Top channels are tried first.</FrameDescription>
				</FrameHeader>
				<Sortable value={channels} onValueChange={setChannels} getItemValue={getItemValue} strategy="vertical" className="space-y-1">
					{channels.map((channel) => (
						<SortableItem key={channel.id} value={channel.id}>
							<FramePanel className="p-0!">
								<div className="flex items-center gap-3 px-3 py-2.5">
									<SortableItemHandle className="text-muted-foreground hover:text-foreground">
										<GripVerticalIcon className="size-4" />
									</SortableItemHandle>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium">{channel.name}</p>
										<p className="text-xs text-muted-foreground">{channel.description}</p>
									</div>
									<ChannelSwitch channel={channel} onToggle={toggleChannel} />
								</div>
							</FramePanel>
						</SortableItem>
					))}
				</Sortable>
			</Frame>
		</div>
	);
}
