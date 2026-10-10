// Typography: the type roles every screen uses. Presentational, themeable
// (token utilities only), and they scale with the system font size. Each role
// sets its typeface (src/lib/fonts.ts): Bricolage Grotesque for headings,
// Geist for everything else, Geist Mono for codes. Weights are families
// (`font-sans-medium`), never weight utilities (`font-medium`).

import * as React from "react";
import { Text, type TextProps } from "react-native";

export interface AppTextProps extends TextProps {
	readonly children: React.ReactNode;
}

/** A screen or section title; announced as a header by screen readers. */
export function Heading({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text accessibilityRole="header" className={`font-heading text-2xl text-foreground ${className ?? ""}`} {...props} />;
}

/** A section title inside a screen. */
export function Subheading({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text accessibilityRole="header" className={`font-heading text-lg text-foreground ${className ?? ""}`} {...props} />;
}

/** Running text. */
export function BodyText({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text className={`font-sans text-base text-foreground ${className ?? ""}`} {...props} />;
}

/** Secondary text: hints, captions, metadata. */
export function MutedText({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text className={`font-sans text-sm text-muted-foreground ${className ?? ""}`} {...props} />;
}

/** A form field's label. */
export function Label({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text className={`font-sans-medium text-sm text-foreground ${className ?? ""}`} {...props} />;
}

/** A field or form error. */
export function ErrorText({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text className={`font-sans text-sm text-destructive-foreground ${className ?? ""}`} {...props} />;
}

/** A code, key or identifier the user may copy: monospaced, selectable by the caller. */
export function CodeText({ className, ...props }: AppTextProps): React.JSX.Element {
	return <Text className={`font-mono text-base text-foreground ${className ?? ""}`} {...props} />;
}
