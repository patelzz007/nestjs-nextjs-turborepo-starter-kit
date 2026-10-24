// A password input: an `Input` that masks what was typed, with an eye button
// that shows or hides it. The same controlled contract as `Input`; the ref
// reaches the `TextInput`.
//
// Whether the password is showing is display state: it starts hidden every
// time the input mounts. A caller that must own it (to hide it again after a
// submit) passes `visible` and `onVisibleChange`, as on the web kit.

import { cva, type VariantProps } from "class-variance-authority";
import EyeIcon from "lucide-react-native/icons/eye";
import EyeOffIcon from "lucide-react-native/icons/eye-off";
import * as React from "react";
import { Pressable, type TextInputInstance } from "react-native";

import { Icon } from "./icon";
import { Input, type InputProps } from "./input";

export const passwordToggleVariants = cva("items-center justify-center rounded-full active:opacity-60", {
	variants: {
		size: {
			sm: "size-8",
			md: "size-9",
			lg: "size-10",
		},
	},
	defaultVariants: { size: "md" },
});

export type PasswordToggleSize = NonNullable<VariantProps<typeof passwordToggleVariants>["size"]>;

/** Extra touch area per size, so each eye button reaches the 44 pt minimum (rules/04): 32 + 2×6, 36 + 2×4, 40 + 2×2. */
const TOGGLE_HIT_SLOP: Readonly<Record<PasswordToggleSize, number>> = {
	sm: 6,
	md: 4,
	lg: 2,
};

export interface PasswordInputProps extends Omit<InputProps, "secureTextEntry" | "trailing"> {
	/** Whether the password is showing, when the caller owns it. */
	readonly visible?: boolean | undefined;
	/** Reports the eye button's toggle. */
	readonly onVisibleChange?: ((visible: boolean) => void) | undefined;
	/** The eye button's name while the password is hidden. */
	readonly showLabel?: string | undefined;
	/** The eye button's name while the password is showing. */
	readonly hideLabel?: string | undefined;
}

export const PasswordInput = React.memo(
	React.forwardRef<TextInputInstance, PasswordInputProps>(function PasswordInput(
		{ visible, onVisibleChange, showLabel = "Show password", hideLabel = "Hide password", size = "md", className, testID, ...props },
		ref,
	): React.JSX.Element {
		const [ownVisible, setOwnVisible] = React.useState(false);
		const isVisible = visible ?? ownVisible;
		const toggleVisible = React.useCallback((): void => {
			setOwnVisible(!isVisible);
			onVisibleChange?.(!isVisible);
		}, [isVisible, onVisibleChange]);

		const toggle = React.useMemo(
			(): React.ReactNode => (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={isVisible ? hideLabel : showLabel}
					onPress={toggleVisible}
					hitSlop={TOGGLE_HIT_SLOP[size]}
					testID={testID === undefined ? undefined : `${testID}-visibility`}
					className={passwordToggleVariants({ size })}>
					<Icon icon={isVisible ? EyeOffIcon : EyeIcon} size="md" colorClassName="accent-muted-foreground" />
				</Pressable>
			),
			[hideLabel, isVisible, showLabel, size, testID, toggleVisible],
		);

		return <Input ref={ref} secureTextEntry={!isVisible} size={size} trailing={toggle} testID={testID} className={className} {...props} />;
	}),
);
