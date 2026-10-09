// Typography: the type roles every screen uses. Presentational, themeable
// (token utilities only), and they scale with the system font size.

import * as React from "react";
import { Text, type TextProps } from "react-native";

export interface AppTextProps extends TextProps {
	readonly children: React.ReactNode;
}

/** A screen or section title; announced as a header by screen readers. */
export function Heading({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text accessibilityRole="header" className={`text-2xl font-semibold text-foreground ${className ?? ""}`} {...props} />;
}

/** A section title inside a screen. */
export function Subheading({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text accessibilityRole="header" className={`text-lg font-semibold text-foreground ${className ?? ""}`} {...props} />;
}

/** Running text. */
export function BodyText({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text className={`text-base text-foreground ${className ?? ""}`} {...props} />;
}

/** Secondary text: hints, captions, metadata. */
export function MutedText({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text className={`text-sm text-muted-foreground ${className ?? ""}`} {...props} />;
}

/** A form field's label. */
export function Label({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text className={`text-sm font-medium text-foreground ${className ?? ""}`} {...props} />;
}

/** A field or form error. */
export function ErrorText({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text className={`text-sm text-destructive-foreground ${className ?? ""}`} {...props} />;
}
