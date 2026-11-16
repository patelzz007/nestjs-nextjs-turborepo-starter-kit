import { Icon } from "@workspace/ui-native/components/icon";
import LinkIcon from "lucide-react-native/icons/link";
import { Text, View } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { useToast } from "../../../toast/facade";

// A connected workspace: a link tile, its status and its last sync.
const TILE = (
	<View className="size-9 items-center justify-center rounded-lg bg-primary">
		<Icon icon={LinkIcon} size="sm" colorClassName="accent-primary-foreground" />
	</View>
);

const STATUS = (
	<View className="flex-row flex-wrap items-center justify-between gap-2">
		<View className="flex-row items-center gap-1">
			<View className="size-1.5 rounded-full bg-success" />
			<Text className="text-caption font-sans-medium text-success-foreground">Active</Text>
		</View>
		<Text className="text-caption font-sans text-muted-foreground">Syncing 3 channels · Last sync: just now</Text>
	</View>
);

export function Sonner20Example(): React.JSX.Element {
	const toast = useToast();
	const shownId = React.useRef<number | null>(null);
	const close = React.useCallback((): void => {
		if (shownId.current !== null) {
			toast.dismissed(shownId.current);
		}
	}, [toast]);
	const show = React.useCallback((): void => {
		shownId.current = toast.success("chat.example.com", {
			title: "Integration Connected",
			leading: TILE,
			content: STATUS,
			actions: (
				<>
					<Button label="Configure" size="xs" variant="outline" onPress={close} />
					<Button label="Open Dashboard" size="xs" onPress={close} />
				</>
			),
		});
	}, [close, toast]);
	return <Button label="Integration Toast" variant="outline" onPress={show} className="self-center" />;
}
