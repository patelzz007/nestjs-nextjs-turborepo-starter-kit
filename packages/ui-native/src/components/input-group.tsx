// An `Input` with addons inside its box: a glyph or a short text before or
// after what is typed ("https://", "USD", a search glass), or any element
// after it (a clear button). The same controlled contract as `Input`; the ref
// reaches the `TextInput`.
//
// The addons are decorative: the input is still named by its label (or the
// field's). `InputGroupText` and `InputGroupIcon` are exported for a custom
// `leading` / `trailing` node.
//
// `header` and `footer` are rows inside the same border, above and below the
// text (a composer's attachments, a prompt box's toolbar, a character count):
// the group then draws the border round all of it and the input sits in it
// borderless. Inside a `Field` the border takes the field's error state.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, type TextInputInstance, type TextInstance, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { FIELD_SURFACE_FILL, useFieldSurface } from "../lib/field-surface";
import { useFieldContext } from "./field";
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
			sm: "text-body",
			md: "text-body-lg",
			lg: "text-h3",
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
	React.forwardRef<TextInstance, InputGroupTextProps>(function InputGroupText({ children, size = "md", className }, ref): React.JSX.Element {
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
	React.forwardRef<ViewInstance, InputGroupIconProps>(function InputGroupIcon({ icon, size = "md", className, testID }, ref): React.JSX.Element {
		return <Icon ref={ref} icon={icon} size={ADDON_ICON_SIZE[size]} colorClassName="accent-icon" className={className} testID={testID} />;
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
	/** Any element before the text, after the leading addons (a key cap, a menu, an avatar). */
	readonly leading?: React.ReactNode | undefined;
	/** A row inside the border above the text (a caption, mention chips). */
	readonly header?: React.ReactNode | undefined;
	/** A row inside the border below the text (a toolbar, a count, actions). */
	readonly footer?: React.ReactNode | undefined;
}

export const inputGroupFrameVariants = cva("rounded-card gap-1 border", {
	variants: {
		state: { default: "border-input", error: "border-destructive", inactive: "border-input opacity-60" },
		surface: { page: FIELD_SURFACE_FILL.page, card: FIELD_SURFACE_FILL.card, popover: FIELD_SURFACE_FILL.popover },
	},
	defaultVariants: { state: "default", surface: "page" },
});

export const InputGroup = React.memo(
	React.forwardRef<TextInputInstance, InputGroupProps>(function InputGroup(
		{ leadingIcon, leadingText, trailingIcon, trailingText, trailing, leading, header, footer, size = "md", className, ...props },
		ref,
	): React.JSX.Element {
		// Memoised so the input below re-renders only when an addon changes.
		const leadingNode = React.useMemo(
			(): React.ReactNode =>
				leadingIcon === undefined && leadingText === undefined && leading === undefined ? null : (
					<View className={inputGroupAddonVariants({ size })}>
						{leadingIcon === undefined ? null : <InputGroupIcon icon={leadingIcon} size={size} />}
						{leadingText === undefined ? null : <InputGroupText size={size}>{leadingText}</InputGroupText>}
						{leading}
					</View>
				),
			[leading, leadingIcon, leadingText, size],
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
		const field = useFieldContext();
		const surface = useFieldSurface();
		if (header === undefined && footer === undefined) {
			return <Input ref={ref} size={size} leading={leadingNode} trailing={trailingNode} className={className} {...props} />;
		}
		const invalid = props.invalid ?? field?.invalid ?? false;
		const inactive = (props.disabled ?? field?.disabled ?? false) || (props.loading ?? field?.loading ?? false);
		return (
			<View className={cn(inputGroupFrameVariants({ state: inactive ? "inactive" : invalid ? "error" : "default", surface }), className)}>
				{header === undefined ? null : <View className="flex-row flex-wrap items-center gap-2 px-3 pt-2.5">{header}</View>}
				<Input ref={ref} size={size} variant="ghost" leading={leadingNode} trailing={trailingNode} {...props} />
				{footer === undefined ? null : <View className="flex-row items-center gap-2 px-2 pb-2">{footer}</View>}
			</View>
		);
	}),
);
