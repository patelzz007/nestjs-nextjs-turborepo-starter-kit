import { Badge } from "@workspace/ui-native/components/badge";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

interface Track {
	readonly id: string;
	readonly title: string;
	readonly artist: string;
	readonly album: string;
	readonly duration: string;
}

const TRACKS: readonly Track[] = [
	{ id: "1", title: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", duration: "4:03" },
	{ id: "2", title: "Digital Love", artist: "Daft Punk", album: "Discovery", duration: "4:58" },
	{ id: "3", title: "Starlight", artist: "Muse", album: "Black Holes and Revelations", duration: "3:59" },
	{ id: "4", title: "Take On Me", artist: "a-ha", album: "Hunting High and Low", duration: "3:48" },
	{ id: "5", title: "Blue Monday", artist: "New Order", album: "Power, Corruption & Lies", duration: "7:29" },
];

const TITLE = "Queue";
/** The track on air: the first in the queue. */
const PLAYING_INDEX = 0;

function getItemValue(track: Track): string {
	return track.id;
}

export function Sortable4Example(): React.JSX.Element {
	const [tracks, setTracks] = React.useState<readonly Track[]>(TRACKS);
	const count = `${String(tracks.length)} tracks`;
	return (
		<Frame>
			<FrameHeader className="flex-row items-center justify-between">
				<View>
					<FrameTitle>{TITLE}</FrameTitle>
					<FrameDescription>{count}</FrameDescription>
				</View>
				<Badge label="Shuffle off" variant="outline" size="sm" />
			</FrameHeader>
			<FramePanel className="p-2">
				<Sortable value={tracks} onValueChange={setTracks} getItemValue={getItemValue} className="gap-0.5">
					{tracks.map((track: Track, position: number): React.JSX.Element => (
						<SortableItem key={track.id} value={track.id} label={track.title}>
							<View className="flex-row items-center gap-2 rounded-md px-1 py-1.5">
								<SortableItemHandle>
									<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
								</SortableItemHandle>
								<View className="flex-1">
									<View className="flex-row items-center gap-1.5">
										<Text numberOfLines={1} className="text-label font-sans-medium shrink text-foreground">
											{track.title}
										</Text>
										{position === PLAYING_INDEX ? <Badge label="Playing" tone="primary" variant="light" size="sm" /> : null}
									</View>
									<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">{`${track.artist} · ${track.album}`}</Text>
								</View>
								<Text className="text-caption font-sans text-muted-foreground tabular-nums">{track.duration}</Text>
							</View>
						</SortableItem>
					))}
				</Sortable>
			</FramePanel>
		</Frame>
	);
}
