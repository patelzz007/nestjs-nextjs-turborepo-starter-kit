// Typography: the type roles every screen uses. Presentational, themeable
// (token utilities only), and they scale with the system font size. Each role
// sets its typeface (src/lib/fonts.ts): Bricolage Grotesque for headings,
// Geist for everything else, Geist Mono for codes. Weights are families
// (`font-sans-medium`), never weight utilities (`font-medium`).
//
// Every role is one variant of `textVariants`, forwards its ref to the native
// `Text` and takes a `className` that is merged last (so a caller can add
// `text-center` or override the colour with another token).
//
// `Label` lives here, with the other roles, rather than in its own
// `label.tsx`: it is a text role like the rest. Form fields compose it through
// `FieldLabel` (./field.tsx).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, type TextInstance, type TextProps } from "react-native";

import { cn } from "../lib/cn";

export const textVariants = cva("", {
	variants: {
		variant: {
			/** A screen or section title. */
			heading: "font-heading text-2xl text-foreground",
			/** A section title inside a screen. */
			subheading: "font-heading text-lg text-foreground",
			/** Running text. */
			body: "font-sans text-base text-foreground",
			/** Secondary text: hints, captions, metadata. */
			muted: "font-sans text-sm text-muted-foreground",
			/** A form field's label. */
			label: "font-sans-medium text-sm text-foreground",
			/** A field or form error. */
			error: "font-sans text-sm text-destructive-foreground",
			/** A code, key or identifier. */
			code: "font-mono text-base text-foreground",
		},
	},
	defaultVariants: { variant: "body" },
});

export type TextVariant = NonNullable<VariantProps<typeof textVariants>["variant"]>;

export interface AppTextProps extends TextProps {
	readonly children: React.ReactNode;
}

/** A screen or section title; announced as a header by screen readers. The role comes first, so a caller can override it. */
export const Heading = React.memo(
	React.forwardRef<TextInstance, AppTextProps>(function Heading({ className, ...props }, ref): React.JSX.Element {
		return <Text ref={ref} accessibilityRole="header" className={cn(textVariants({ variant: "heading" }), className)} {...props} />;
	}),
);

/** A section title inside a screen; announced as a header. */
export const Subheading = React.memo(
	React.forwardRef<TextInstance, AppTextProps>(function Subheading({ className, ...props }, ref): React.JSX.Element {
		return <Text ref={ref} accessibilityRole="header" className={cn(textVariants({ variant: "subheading" }), className)} {...props} />;
	}),
);

/** Running text. */
export const BodyText = React.memo(
	React.forwardRef<TextInstance, AppTextProps>(function BodyText({ className, ...props }, ref): React.JSX.Element {
		return <Text ref={ref} className={cn(textVariants({ variant: "body" }), className)} {...props} />;
	}),
);

/** Secondary text: hints, captions, metadata. */
export const MutedText = React.memo(
	React.forwardRef<TextInstance, AppTextProps>(function MutedText({ className, ...props }, ref): React.JSX.Element {
		return <Text ref={ref} className={cn(textVariants({ variant: "muted" }), className)} {...props} />;
	}),
);

/** A form field's label (inside a form, prefer `FieldLabel`, which ties it to its control). */
export const Label = React.memo(
	React.forwardRef<TextInstance, AppTextProps>(function Label({ className, ...props }, ref): React.JSX.Element {
		return <Text ref={ref} className={cn(textVariants({ variant: "label" }), className)} {...props} />;
	}),
);

/** A field or form error. */
export const ErrorText = React.memo(
	React.forwardRef<TextInstance, AppTextProps>(function ErrorText({ className, ...props }, ref): React.JSX.Element {
		return <Text ref={ref} className={cn(textVariants({ variant: "error" }), className)} {...props} />;
	}),
);

/** A code, key or identifier the user may copy: monospaced, selectable by the caller. */
export const CodeText = React.memo(
	React.forwardRef<TextInstance, AppTextProps>(function CodeText({ className, ...props }, ref): React.JSX.Element {
		return <Text ref={ref} className={cn(textVariants({ variant: "code" }), className)} {...props} />;
	}),
);
