// An `Input` with addons inside its box: a glyph or a short text before or
// after what is typed ("https://", "USD", a search glass), or any element
// after it (a clear button). The same controlled contract as `Input`; the ref
// reaches the `TextInput`.
//
// The addons are decorative: the input is still named by its label (or the
// field's). `InputGroupText` and `InputGroupIcon` are exported for a custom
// `leading` / `trailing` node.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type TextInput } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type IconSize, type LucideIcon } from "./icon";
import { Input, type InputProps, type InputSize } from "./input";

export const inputGroupAddonVariants = cva("shrink-0 flex-row items-center", {
	variants: {
		variant: {
			default: "",
		},
		size: {
			sm: "gap-1",
			md: "gap-1.5",
			lg: "gap-2",
		},
	},
	defaultVariants: { variant: "default", size: "md" },
});

export const inputGroupTextVariants = cva("font-sans text-muted-foreground", {
	variants: {
		size: {
			sm: "text-sm",
			md: "text-base",
			lg: "text-lg",
		},
	},
	defaultVariants: { size: "md" },
});

export type InputGroupAddonSize = NonNullable<VariantProps<typeof inputGroupAddonVariants>["size"]>;

/** The glyph size that sits beside each input size's text. */
const ADDON_ICON_SIZE: Readonly<Record<InputSize, IconSize>> = {
	sm: "sm",
	md: "md",
	lg: "lg",
};

export interface InputGroupTextProps {
	readonly children: string;
	readonly size?: InputGroupAddonSize | undefined;
	readonly className?: string | undefined;
}

/** A short, muted text addon ("https://", "USD"). Hidden from screen readers: the label names the input. */
export const InputGroupText = React.memo(
	React.forwardRef<Text, InputGroupTextProps>(function InputGroupText({ children, size = "md", className }, ref): React.JSX.Element {
		return (
			<Text ref={ref} accessible={false} importantForAccessibility="no" className={cn(inputGroupTextVariants({ size }), className)}>
				{children}
			</Text>
		);
	}),
);

export interface InputGroupIconProps {
	readonly icon: LucideIcon;
	readonly size?: InputGroupAddonSize | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A muted glyph addon (a search glass, an at sign). */
export const InputGroupIcon = React.memo(
	React.forwardRef<View, InputGroupIconProps>(function InputGroupIcon({ icon, size = "md", className, testID }, ref): React.JSX.Element {
		return <Icon ref={ref} icon={icon} size={ADDON_ICON_SIZE[size]} colorClassName="accent-muted-foreground" className={className} testID={testID} />;
	}),
);

export interface InputGroupProps extends Omit<InputProps, "leading" | "trailing"> {
	/** A glyph before the text. */
	readonly leadingIcon?: LucideIcon | undefined;
	/** A short text before the text ("https://"). */
	readonly leadingText?: string | undefined;
	/** A glyph after the text. */
	readonly trailingIcon?: LucideIcon | undefined;
	/** A short text after the text ("USD"). */
	readonly trailingText?: string | undefined;
	/** Any element after the text and the trailing addons (a clear button). */
	readonly trailing?: React.ReactNode | undefined;
}

export const InputGroup = React.memo(
	React.forwardRef<TextInput, InputGroupProps>(function InputGroup(
		{ leadingIcon, leadingText, trailingIcon, trailingText, trailing, size = "md", ...props },
		ref,
	): React.JSX.Element {
		// Memoised so the input below re-renders only when an addon changes.
		const leadingNode = React.useMemo(
			(): React.ReactNode =>
				leadingIcon === undefined && leadingText === undefined ? null : (
					<View className={inputGroupAddonVariants({ size })}>
						{leadingIcon === undefined ? null : <InputGroupIcon icon={leadingIcon} size={size} />}
						{leadingText === undefined ? null : <InputGroupText size={size}>{leadingText}</InputGroupText>}
					</View>
				),
			[leadingIcon, leadingText, size],
		);
		const trailingNode = React.useMemo(
			(): React.ReactNode =>
				trailingIcon === undefined && trailingText === undefined && trailing === undefined ? null : (
					<View className={inputGroupAddonVariants({ size })}>
						{trailingText === undefined ? null : <InputGroupText size={size}>{trailingText}</InputGroupText>}
						{trailingIcon === undefined ? null : <InputGroupIcon icon={trailingIcon} size={size} />}
						{trailing}
					</View>
				),
			[size, trailing, trailingIcon, trailingText],
		);
		return <Input ref={ref} size={size} leading={leadingNode} trailing={trailingNode} {...props} />;
	}),
);
