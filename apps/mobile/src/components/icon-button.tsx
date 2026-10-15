// A square button that is only a glyph ("Add a picture" beside a comment's
// buttons), with the outlined look of a secondary button. Its name is spoken,
// never shown, so `label` is required. Data-agnostic and controlled: busy shows
// a spinner and blocks presses; the touch target is the 44 pt minimum (rules/04).

import * as React from "react";
import { ActivityIndicator, Pressable, type View } from "react-native";

import { Icon, type LucideIcon } from "./icon";

export interface IconButtonProps {
	readonly icon: LucideIcon;
	/** The accessible name — what the button does ("Add a picture"). */
	readonly label: string;
	readonly onPress: () => void;
	/** Work is in flight: a spinner in place of the glyph, and presses are blocked. */
	readonly loading?: boolean;
	readonly disabled?: boolean;
	readonly accessibilityHint?: string;
	readonly testID?: string;
}

export const IconButton = React.forwardRef<View, IconButtonProps>(function IconButton(
	{ icon, label, onPress, loading = false, disabled = false, accessibilityHint, testID },
	ref,
): React.JSX.Element {
	const isInactive = disabled || loading;
	return (
		<Pressable
			ref={ref}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled: isInactive, busy: loading }}
			disabled={isInactive}
			onPress={onPress}
			testID={testID}
			className={`size-11 items-center justify-center rounded-lg border border-border bg-card active:opacity-80 ${isInactive ? "opacity-60" : ""}`}>
			{loading ? <ActivityIndicator size="small" colorClassName="accent-foreground" /> : <Icon icon={icon} size="md" colorClassName="accent-foreground" />}
		</Pressable>
	);
});
