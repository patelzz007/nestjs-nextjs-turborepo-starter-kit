// A quiet round button fixed in the screen's top-left corner, above whatever
// screen is showing (the app drawer's menu button, ADR 038). Rendered once by a
// layout and never re-mounted: its CornerOverlay fades it in and out instead,
// and it takes no touches and is hidden from screen readers while invisible.
// Page-coloured, translucent, hairline-bordered and shadowless — present
// without announcing itself. Presentational: the caller says what it is, does,
// and when it shows.

import * as React from "react";
import { Pressable } from "react-native";

import { CornerOverlay } from "./corner-overlay";
import { Icon, type LucideIcon } from "./icon";

export interface CornerButtonProps {
	readonly icon: LucideIcon;
	/** What the button does, for screen readers ("Open menu"). */
	readonly accessibilityLabel: string;
	readonly onPress: () => void;
	readonly visible: boolean;
	/** The top safe-area inset, in points. */
	readonly topInset: number;
	readonly testID?: string;
}

export function CornerButton({ icon, accessibilityLabel, onPress, visible, topInset, testID }: CornerButtonProps): React.JSX.Element {
	return (
		<CornerOverlay side="left" visible={visible} topInset={topInset}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel}
				onPress={onPress}
				hitSlop={4}
				testID={testID}
				className="size-11 items-center justify-center rounded-full border border-border bg-background/90 active:opacity-70">
				<Icon icon={icon} size="md" colorClassName="accent-foreground" />
			</Pressable>
		</CornerOverlay>
	);
}
