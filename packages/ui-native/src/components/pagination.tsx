// Moving through a paged list (the web kit's `Pagination`). By default the
// phone's compact form: Previous and Next around a "Page 2 of 10" indicator.
// With `pages="numbers"` the page buttons show between the arrows, shortened
// with ellipses around the current page (`siblingCount`, `boundaryCount`,
// `showLastPage`); the arrows can be words, chevrons, or both ends' jumps to
// the first and last page (`showEdges`). Page buttons can be square, round, or
// joined into one bordered strip (`variant="strip"`).
//
// Controlled: the caller owns `page` (1-based) and `pageCount` and hears every
// request through `onChange(page)`; the buttons at either end are disabled
// rather than clamping a request. Default copy is generic and overridable.

import { cva, type VariantProps } from "class-variance-authority";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import ChevronsLeftIcon from "lucide-react-native/icons/chevrons-left";
import ChevronsRightIcon from "lucide-react-native/icons/chevrons-right";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Button, type ButtonSize } from "./button";
import { IconButton } from "./icon-button";

export const paginationVariants = cva("flex-row items-center gap-2", {
	variants: {
		/** `default`: bordered buttons. `ghost`: borderless, for a toolbar under a list. `strip`: the pages joined into one bordered strip. */
		variant: { default: "", ghost: "", strip: "" },
		size: { md: "", sm: "" },
		/** Where the page info sits: between the arrows (default), or at the start with the arrows grouped at the end. */
		infoPosition: { between: "justify-between", start: "justify-between" },
		/** The buttons dim themselves when inactive, so the container adds nothing (no double dimming). */
		state: {
			default: "",
			loading: "",
			disabled: "",
			error: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", infoPosition: "between", state: "default" },
});

export const paginationIndicatorVariants = cva("font-sans-medium shrink text-center text-muted-foreground", {
	variants: {
		size: { md: "text-body", sm: "text-caption" },
	},
	defaultVariants: { size: "md" },
});

/** One page button: outlined (or filled) while it is the current page. */
export const paginationPageVariants = cva("min-w-10 items-center justify-center px-2", {
	variants: {
		variant: { default: "border", ghost: "border", strip: "border-l border-border" },
		shape: { square: "rounded-lg", circle: "rounded-full" },
		current: { true: "", false: "border-transparent active:bg-muted" },
		size: { md: "h-11", sm: "h-9" },
		/** The current page filled with the primary colour instead of outlined. */
		filled: { true: "", false: "" },
	},
	compoundVariants: [
		{ current: true, filled: false, variant: ["default", "ghost"], className: "border-border bg-card" },
		{ current: true, filled: true, className: "border-primary bg-primary" },
		{ current: true, variant: "strip", filled: false, className: "bg-muted" },
		{ variant: "strip", className: "rounded-none" },
	],
	defaultVariants: { variant: "default", shape: "square", current: false, size: "md", filled: false },
});

const paginationPageLabelVariants = cva("text-body tabular-nums", {
	variants: {
		current: { true: "font-sans-semibold", false: "font-sans" },
		filled: { true: "", false: "" },
	},
	compoundVariants: [
		{ current: true, filled: true, className: "text-primary-foreground" },
		{ current: true, filled: false, className: "text-foreground" },
		{ current: false, className: "text-foreground" },
	],
	defaultVariants: { current: false, filled: false },
});

type PaginationVariantProps = VariantProps<typeof paginationVariants>;
export type PaginationVariant = NonNullable<PaginationVariantProps["variant"]>;
export type PaginationSize = NonNullable<PaginationVariantProps["size"]>;
export type PaginationInfoPosition = NonNullable<PaginationVariantProps["infoPosition"]>;
export type PaginationPageShape = "square" | "circle";

const BUTTON_VARIANT: Readonly<Record<PaginationVariant, "secondary" | "ghost">> = { default: "secondary", ghost: "ghost", strip: "secondary" };
const BUTTON_SIZE: Readonly<Record<PaginationSize, ButtonSize>> = { md: "md", sm: "sm" };
const ICON_BUTTON_VARIANT: Readonly<Record<PaginationVariant, "secondary" | "ghost">> = { default: "secondary", ghost: "ghost", strip: "secondary" };

/** "Page 2 of 10". */
export function defaultPageLabel(page: number, pageCount: number): string {
	return `Page ${String(page)} of ${String(pageCount)}`;
}

/** A gap in the numbered pages. */
export const PAGINATION_ELLIPSIS = "ellipsis";
export type PaginationItem = number | typeof PAGINATION_ELLIPSIS;

export interface PaginationRangeOptions {
	/** Pages shown on each side of the current one. */
	readonly siblingCount: number;
	/** Pages always shown at each end. */
	readonly boundaryCount: number;
	/** Show the last pages (else the list ends in an ellipsis). */
	readonly showLastPage: boolean;
}

/** The numbered pages to show: the ends, the current page with its neighbours, and an ellipsis for each gap of 2 or more. */
export function paginationRange(page: number, pageCount: number, options: PaginationRangeOptions): readonly PaginationItem[] {
	const shown = new Set<number>();
	const add = (from: number, to: number): void => {
		for (let at = Math.max(from, 1); at <= Math.min(to, pageCount); at += 1) {
			shown.add(at);
		}
	};
	add(1, options.boundaryCount);
	if (options.showLastPage) {
		add(pageCount - options.boundaryCount + 1, pageCount);
	}
	add(page - options.siblingCount, page + options.siblingCount);
	const sorted = [...shown].sort((left: number, right: number): number => left - right);
	const items: PaginationItem[] = [];
	sorted.forEach((at: number, index: number): void => {
		const previous = sorted.at(index - 1);
		if (index > 0 && previous !== undefined && at - previous === 2) {
			items.push(previous + 1);
		} else if (index > 0 && previous !== undefined && at - previous > 2) {
			items.push(PAGINATION_ELLIPSIS);
		}
		items.push(at);
	});
	if (!options.showLastPage && (sorted.at(-1) ?? pageCount) < pageCount) {
		items.push(PAGINATION_ELLIPSIS);
	}
	return items;
}

export interface PaginationProps {
	/** The page shown (1-based). */
	readonly page: number;
	/** How many pages there are (at least 1). */
	readonly pageCount: number;
	/** Called with the page the user asks for. */
	readonly onChange: (page: number) => void;
	readonly variant?: PaginationVariant | undefined;
	readonly size?: PaginationSize | undefined;
	/** `info` (default): "Page 2 of 10" between the arrows. `numbers`: the page buttons. `none`: only the arrows. */
	readonly pages?: "info" | "numbers" | "none" | undefined;
	/** The arrows as words (default), as chevrons, or not at all. */
	readonly arrows?: "labels" | "icons" | "none" | undefined;
	/** Jumps to the first and last page at the ends. */
	readonly showEdges?: boolean | undefined;
	/** Where "Page 2 of 10" sits. */
	readonly infoPosition?: PaginationInfoPosition | undefined;
	readonly pageShape?: PaginationPageShape | undefined;
	/** The current page filled with the primary colour, not outlined. */
	readonly filledCurrent?: boolean | undefined;
	readonly siblingCount?: number | undefined;
	readonly boundaryCount?: number | undefined;
	/** Show the last pages after the ellipsis. Default `true`. */
	readonly showLastPage?: boolean | undefined;
	/** The requested page is loading: the buttons are blocked and the group is announced as busy. */
	readonly loading?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	readonly previousLabel?: string | undefined;
	readonly nextLabel?: string | undefined;
	readonly firstLabel?: string | undefined;
	readonly lastLabel?: string | undefined;
	/** The indicator's wording; defaults to "Page 2 of 10". */
	readonly formatPageLabel?: ((page: number, pageCount: number) => string) | undefined;
	/** The group's accessible name; defaults to "Pagination". */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the container, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface PageButtonProps {
	readonly page: number;
	readonly current: boolean;
	readonly disabled: boolean;
	readonly variant: PaginationVariant;
	readonly shape: PaginationPageShape;
	readonly size: PaginationSize;
	readonly filled: boolean;
	readonly onChange: (page: number) => void;
}

const PageButton = React.memo(function PageButton({ page, current, disabled, variant, shape, size, filled, onChange }: PageButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		if (!current) {
			onChange(page);
		}
	}, [current, onChange, page]);
	const accessibilityState = React.useMemo(() => ({ selected: current, disabled }), [current, disabled]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Page ${String(page)}`}
			accessibilityState={accessibilityState}
			disabled={disabled}
			onPress={press}
			className={paginationPageVariants({ variant, shape, current, size, filled })}>
			<Text className={paginationPageLabelVariants({ current, filled })}>{String(page)}</Text>
		</Pressable>
	);
});

const EDGE_LABELS = { previous: "Previous", next: "Next", first: "First page", last: "Last page" };

export const Pagination = React.memo(
	React.forwardRef<ViewInstance, PaginationProps>(function Pagination(
		{
			page,
			pageCount,
			onChange,
			variant = "default",
			size = "md",
			pages = "info",
			arrows = "labels",
			showEdges = false,
			infoPosition = "between",
			pageShape = "square",
			filledCurrent = false,
			siblingCount = 1,
			boundaryCount = 1,
			showLastPage = true,
			loading = false,
			disabled = false,
			previousLabel = EDGE_LABELS.previous,
			nextLabel = EDGE_LABELS.next,
			firstLabel = EDGE_LABELS.first,
			lastLabel = EDGE_LABELS.last,
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
		const goPrevious = React.useCallback((): void => {
			onChange(page - 1);
		}, [onChange, page]);
		const goNext = React.useCallback((): void => {
			onChange(page + 1);
		}, [onChange, page]);
		const goFirst = React.useCallback((): void => {
			onChange(1);
		}, [onChange]);
		const goLast = React.useCallback((): void => {
			onChange(pageCount);
		}, [onChange, pageCount]);
		const atStart = isInactive || page <= 1;
		const atEnd = isInactive || page >= pageCount;
		const arrow = (direction: "previous" | "next"): React.ReactNode => {
			const isPrevious = direction === "previous";
			if (arrows === "none") {
				return null;
			}
			if (arrows === "icons") {
				return (
					<IconButton
						icon={isPrevious ? ChevronLeftIcon : ChevronRightIcon}
						label={isPrevious ? previousLabel : nextLabel}
						variant={ICON_BUTTON_VARIANT[variant]}
						size={size === "sm" ? "sm" : "md"}
						disabled={isPrevious ? atStart : atEnd}
						onPress={isPrevious ? goPrevious : goNext}
						testID={testID === undefined ? undefined : `${testID}-${direction}`}
					/>
				);
			}
			return (
				<Button
					label={isPrevious ? previousLabel : nextLabel}
					icon={isPrevious ? ChevronLeftIcon : ChevronRightIcon}
					iconPosition={isPrevious ? "start" : "end"}
					onPress={isPrevious ? goPrevious : goNext}
					variant={BUTTON_VARIANT[variant]}
					size={BUTTON_SIZE[size]}
					disabled={isPrevious ? atStart : atEnd}
					testID={testID === undefined ? undefined : `${testID}-${direction}`}
				/>
			);
		};
		const edge = (which: "first" | "last"): React.ReactNode =>
			showEdges ? (
				<IconButton
					icon={which === "first" ? ChevronsLeftIcon : ChevronsRightIcon}
					label={which === "first" ? firstLabel : lastLabel}
					variant={ICON_BUTTON_VARIANT[variant]}
					size={size === "sm" ? "sm" : "md"}
					disabled={which === "first" ? atStart : atEnd}
					onPress={which === "first" ? goFirst : goLast}
				/>
			) : null;
		const info = (
			<Text className={paginationIndicatorVariants({ size })} accessibilityLiveRegion="polite" numberOfLines={1}>
				{formatPageLabel(page, pageCount)}
			</Text>
		);
		const numbers =
			pages === "numbers" ? (
				<View className={cn("flex-row items-center", variant === "strip" ? "overflow-hidden rounded-lg border-y border-r border-border" : "gap-1")}>
					{paginationRange(page, pageCount, { siblingCount, boundaryCount, showLastPage }).map((item: PaginationItem, index: number): React.JSX.Element =>
						item === PAGINATION_ELLIPSIS ? (
							<Text key={`gap-${String(index)}`} importantForAccessibility="no" className="text-body w-8 text-center font-sans text-muted-foreground">
								…
							</Text>
						) : (
							<PageButton
								key={item}
								page={item}
								current={item === page}
								disabled={isInactive}
								variant={variant}
								shape={pageShape}
								size={size}
								filled={filledCurrent}
								onChange={onChange}
							/>
						),
					)}
				</View>
			) : null;
		const middle = pages === "info" ? info : numbers;
		return (
			<View
				ref={ref}
				role="toolbar"
				accessibilityLabel={accessibilityLabel}
				accessibilityState={accessibilityState}
				testID={testID}
				className={cn(paginationVariants({ variant, size, infoPosition, state }), className)}>
				{infoPosition === "start" && pages === "info" ? (
					<>
						{info}
						<View className="flex-row items-center gap-2">
							{edge("first")}
							{arrow("previous")}
							{arrow("next")}
							{edge("last")}
						</View>
					</>
				) : (
					<>
						<View className="flex-row items-center gap-2">
							{edge("first")}
							{arrow("previous")}
						</View>
						{middle}
						<View className="flex-row items-center gap-2">
							{arrow("next")}
							{edge("last")}
						</View>
					</>
				)}
			</View>
		);
	}),
);
