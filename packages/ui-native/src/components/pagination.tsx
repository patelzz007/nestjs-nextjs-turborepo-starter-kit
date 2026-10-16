// Previous / next through a paged list, with the page indicator between them
// ("Page 2 of 10"). Controlled: the caller owns `page` (1-based) and
// `pageCount` and hears every request through `onChange(page)`; the buttons
// at either end are disabled rather than clamping a request. Default copy is
// generic and overridable. The mobile counterpart of the web kit's
// `Pagination` (a phone has no room for numbered page links).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Button, type ButtonSize } from "./button";

export const paginationVariants = cva("flex-row items-center justify-between gap-3", {
	variants: {
		/** `default`: bordered buttons. `ghost`: borderless, for a toolbar under a list. */
		variant: { default: "", ghost: "" },
		size: { md: "", sm: "" },
		/** The buttons dim themselves when inactive, so the container adds nothing (no double dimming). */
		state: {
			default: "",
			loading: "",
			disabled: "",
			error: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

export const paginationIndicatorVariants = cva("font-sans-medium shrink text-center text-muted-foreground", {
	variants: {
		size: { md: "text-sm", sm: "text-xs" },
	},
	defaultVariants: { size: "md" },
});

type PaginationVariantProps = VariantProps<typeof paginationVariants>;
export type PaginationVariant = NonNullable<PaginationVariantProps["variant"]>;
export type PaginationSize = NonNullable<PaginationVariantProps["size"]>;

const BUTTON_VARIANT: Readonly<Record<PaginationVariant, "secondary" | "ghost">> = { default: "secondary", ghost: "ghost" };
const BUTTON_SIZE: Readonly<Record<PaginationSize, ButtonSize>> = { md: "md", sm: "sm" };

/** "Page 2 of 10". */
export function defaultPageLabel(page: number, pageCount: number): string {
	return `Page ${String(page)} of ${String(pageCount)}`;
}

export interface PaginationProps {
	/** The page shown (1-based). */
	readonly page: number;
	/** How many pages there are (at least 1). */
	readonly pageCount: number;
	/** Called with the page the user asks for. */
	readonly onChange: (page: number) => void;
	readonly variant?: PaginationVariant;
	readonly size?: PaginationSize;
	/** The requested page is loading: both buttons are blocked and the group is announced as busy. */
	readonly loading?: boolean;
	readonly disabled?: boolean;
	readonly previousLabel?: string;
	readonly nextLabel?: string;
	/** The indicator's wording; defaults to "Page 2 of 10". */
	readonly formatPageLabel?: (page: number, pageCount: number) => string;
	/** The group's accessible name; defaults to "Pagination". */
	readonly accessibilityLabel?: string;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const Pagination = React.memo(
	React.forwardRef<View, PaginationProps>(function Pagination(
		{
			page,
			pageCount,
			onChange,
			variant = "default",
			size = "md",
			loading = false,
			disabled = false,
			previousLabel = "Previous",
			nextLabel = "Next",
			formatPageLabel = defaultPageLabel,
			accessibilityLabel = "Pagination",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);
		const handlePrevious = React.useCallback((): void => {
			onChange(page - 1);
		}, [onChange, page]);
		const handleNext = React.useCallback((): void => {
			onChange(page + 1);
		}, [onChange, page]);
		return (
			<View
				ref={ref}
				role="toolbar"
				accessibilityLabel={accessibilityLabel}
				accessibilityState={accessibilityState}
				testID={testID}
				className={cn(paginationVariants({ variant, size, state }), className)}>
				<Button
					label={previousLabel}
					onPress={handlePrevious}
					variant={BUTTON_VARIANT[variant]}
					size={BUTTON_SIZE[size]}
					disabled={isInactive || page <= 1}
					{...(testID === undefined ? {} : { testID: `${testID}-previous` })}
				/>
				<Text className={paginationIndicatorVariants({ size })} accessibilityLiveRegion="polite" numberOfLines={1}>
					{formatPageLabel(page, pageCount)}
				</Text>
				<Button
					label={nextLabel}
					onPress={handleNext}
					variant={BUTTON_VARIANT[variant]}
					size={BUTTON_SIZE[size]}
					disabled={isInactive || page >= pageCount}
					{...(testID === undefined ? {} : { testID: `${testID}-next` })}
				/>
			</View>
		);
	}),
);
