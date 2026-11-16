import { Button } from "@workspace/ui-native/components/button";
import { Drawer, type SheetSide } from "@workspace/ui-native/components/sheet";
import * as React from "react";
import { Text, View } from "react-native";

const SIDES: readonly SheetSide[] = ["top", "right", "bottom", "left"];
const BODY = "Swipe it back toward its edge to close it.";

function SideTrigger({ side, onOpen }: { readonly side: SheetSide; readonly onOpen: (side: SheetSide) => void }): React.JSX.Element {
	const open = React.useCallback((): void => {
		onOpen(side);
	}, [onOpen, side]);
	return (
		<View className="w-1/2 p-1">
			<Button label={side} variant="outline" onPress={open} />
		</View>
	);
}

export function Drawer5Example(): React.JSX.Element {
	const [side, setSide] = React.useState<SheetSide | null>(null);
	const changeOpen = React.useCallback((open: boolean): void => {
		if (!open) {
			setSide(null);
		}
	}, []);
	return (
		<View className="flex-row flex-wrap">
			{SIDES.map((edge: SheetSide): React.JSX.Element => (
				<SideTrigger key={edge} side={edge} onOpen={setSide} />
			))}
			<Drawer open={side !== null} onOpenChange={changeOpen} side={side ?? "right"} title={`From the ${side ?? "right"}`}>
				<Text className="text-body font-sans text-muted-foreground">{BODY}</Text>
			</Drawer>
		</View>
	);
}
