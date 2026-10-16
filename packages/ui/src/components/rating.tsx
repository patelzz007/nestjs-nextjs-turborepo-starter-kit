"use client";

// Ported from ReUI (https://reui.io/r/base-vega/rating.json). `Rating`, its
// props (`rating`, `maxRating`, `size`, `showValue`, `starClassName`,
// `editable`, `onRatingChange`) and `data-slot` attributes match ReUI, so its
// examples apply, with these deliberate deviations:
// - Accessible: read-only, the root is an `img` named by the rating
//   ("Rated 3.5 out of 5"); editable, it is a `radiogroup` of star `radio`
//   buttons with a roving tab stop, arrow / Home / End keys and focus rings.
//   ReUI's stars were click-only `div`s.
// - `disabled` and `aria-invalid` drive a CVA `state` axis.
// - Star colours read the categorical tone tokens instead of `yellow-400`.
// - All copy comes from the `rating` family of `UiKitLabelsProvider`.
// - The root forwards its ref.
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva, type VariantProps } from "class-variance-authority";
import { StarIcon } from "lucide-react";
import * as React from "react";

/** Copy for the rating — the `rating` family of `UiKitLabels`. */
export interface RatingLabels {
	/** Accessible name of an editable rating when the caller gives none. */
	readonly ariaLabel: string;
	/** Accessible name of a read-only rating, e.g. "Rated 3.5 out of 5". */
	readonly value: (rating: string, maxRating: number) => string;
	/** Accessible name of one star button, e.g. "3 stars". */
	readonly star: (star: number, maxRating: number) => string;
}

/** The number of stars when `maxRating` is omitted. */
const DEFAULT_MAX_RATING = 5;
/** Decimal places of the numeric value (`showValue`) and the read-only name. */
const RATING_VALUE_FRACTION_DIGITS = 1;
/** A star's fill width is a percentage of the star. */
const FULL_PERCENT = 100;
/** The lowest star a keyboard user can move to. */
const FIRST_STAR = 1;

const ratingVariants = cva("flex items-center", {
	variants: {
		size: {
			sm: "gap-2",
			default: "gap-2.5",
			lg: "gap-3",
		},
		state: {
			default: "",
			loading: "pointer-events-none opacity-60",
			disabled: "pointer-events-none opacity-50",
			error: "rounded-md ring-2 ring-destructive/30",
		},
	},
	defaultVariants: {
		size: "default",
		state: "default",
	},
});

const starVariants = cva("", {
	variants: {
		size: {
			sm: "size-4",
			default: "size-5",
			lg: "size-6",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

const valueVariants = cva("w-5 text-muted-foreground tabular-nums", {
	variants: {
		size: {
			sm: "text-xs",
			default: "text-sm",
			lg: "text-base",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

type RatingSize = NonNullable<VariantProps<typeof ratingVariants>["size"]>;

interface RatingProps extends Omit<React.ComponentProps<"div">, "children">, Omit<VariantProps<typeof ratingVariants>, "state"> {
	/** Current rating value (decimals render partial stars). */
	readonly rating: number;
	/** Maximum rating value (number of stars to show). */
	readonly maxRating?: number | undefined;
	/** Whether to show the numeric rating value. */
	readonly showValue?: boolean | undefined;
	/** Class name for the value span. */
	readonly starClassName?: string | undefined;
	/** Whether the rating is editable (clickable and keyboard operable). */
	readonly editable?: boolean | undefined;
	/** Called with the star the user picks. */
	readonly onRatingChange?: ((rating: number) => void) | undefined;
	/** Disables an editable rating. */
	readonly disabled?: boolean | undefined;
	/** Per-usage overrides of the `rating` copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"rating"> | undefined;
}

/** How much of `star` (1-based) is filled at `displayRating`, as a percentage. */
function starFillPercent(star: number, displayRating: number): number {
	if (displayRating >= star) {
		return FULL_PERCENT;
	}
	if (displayRating > star - 1) {
		return (displayRating - (star - 1)) * FULL_PERCENT;
	}
	return 0;
}

/** The star a key moves to, or `undefined` for a key the rating ignores. */
function starForKey(key: string, current: number, maxRating: number): number | undefined {
	switch (key) {
		case "ArrowRight":
		case "ArrowUp":
			return Math.min(maxRating, current + 1);
		case "ArrowLeft":
		case "ArrowDown":
			return Math.max(FIRST_STAR, current - 1);
		case "Home":
			return FIRST_STAR;
		case "End":
			return maxRating;
		default:
			return undefined;
	}
}

interface RatingStarGlyphsProps {
	readonly size: RatingSize | null | undefined;
	readonly fillPercent: number;
}

/** The empty star with the filled star clipped over it. */
function RatingStarGlyphs({ size, fillPercent }: RatingStarGlyphsProps): React.JSX.Element {
	const fillStyle = React.useMemo<React.CSSProperties>(() => ({ width: `${String(fillPercent)}%` }), [fillPercent]);
	return (
		<>
			<StarIcon aria-hidden data-slot="rating-star-empty" className={cn(starVariants({ size }), "text-muted-foreground/30")} />
			<span className="absolute inset-0 overflow-hidden" style={fillStyle}>
				<StarIcon aria-hidden data-slot="rating-star-filled" className={cn(starVariants({ size }), "fill-tone-yellow text-tone-yellow")} />
			</span>
		</>
	);
}

interface RatingStarButtonProps {
	readonly star: number;
	readonly maxRating: number;
	readonly size: RatingSize | null | undefined;
	readonly fillPercent: number;
	readonly checked: boolean;
	readonly tabbable: boolean;
	readonly disabled: boolean;
	readonly label: string;
	readonly onSelect: (star: number) => void;
	readonly onHover: (star: number | null) => void;
	readonly registerButton: (star: number, node: HTMLButtonElement | null) => void;
}

function RatingStarButton({
	star,
	maxRating,
	size,
	fillPercent,
	checked,
	tabbable,
	disabled,
	label,
	onSelect,
	onHover,
	registerButton,
}: RatingStarButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(star);
	}, [onSelect, star]);

	const handleMouseEnter = React.useCallback((): void => {
		onHover(star);
	}, [onHover, star]);

	const handleMouseLeave = React.useCallback((): void => {
		onHover(null);
	}, [onHover]);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>): void => {
			const next = starForKey(event.key, star, maxRating);
			if (next === undefined) {
				return;
			}
			event.preventDefault();
			onSelect(next);
		},
		[maxRating, onSelect, star],
	);

	const setRef = React.useCallback(
		(node: HTMLButtonElement | null): void => {
			registerButton(star, node);
		},
		[registerButton, star],
	);

	return (
		<button
			ref={setRef}
			type="button"
			role="radio"
			aria-checked={checked}
			aria-label={label}
			tabIndex={tabbable ? 0 : -1}
			disabled={disabled}
			data-slot="rating-star"
			className="relative cursor-pointer rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
			onClick={handleClick}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onKeyDown={handleKeyDown}>
			<RatingStarGlyphs size={size} fillPercent={fillPercent} />
		</button>
	);
}

/** A row of stars showing (or, `editable`, choosing) a rating out of `maxRating`. */
const Rating = React.forwardRef<HTMLDivElement, RatingProps>(function Rating(
	{
		rating,
		maxRating = DEFAULT_MAX_RATING,
		size,
		className,
		starClassName,
		showValue = false,
		editable = false,
		onRatingChange,
		disabled = false,
		labels: labelsOverride,
		"aria-invalid": ariaInvalid,
		"aria-label": ariaLabel,
		...props
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("rating", labelsOverride);
	const [hoveredRating, setHoveredRating] = React.useState<number | null>(null);
	const buttonsRef = React.useRef<Map<number, HTMLButtonElement>>(new Map());
	const interactive = editable && !disabled;
	const displayRating = interactive && hoveredRating !== null ? hoveredRating : rating;
	const state = resolveFieldState({ disabled, ariaInvalid });
	const stars = React.useMemo((): number[] => Array.from({ length: maxRating }, (_, index): number => index + FIRST_STAR), [maxRating]);
	const formattedRating = displayRating.toFixed(RATING_VALUE_FRACTION_DIGITS);
	const checkedStar = Math.round(rating);

	const registerButton = React.useCallback((star: number, node: HTMLButtonElement | null): void => {
		if (node === null) {
			buttonsRef.current.delete(star);
			return;
		}
		buttonsRef.current.set(star, node);
	}, []);

	const handleSelect = React.useCallback(
		(star: number): void => {
			if (!interactive) {
				return;
			}
			buttonsRef.current.get(star)?.focus();
			onRatingChange?.(star);
		},
		[interactive, onRatingChange],
	);

	const handleHover = React.useCallback(
		(star: number | null): void => {
			if (interactive) {
				setHoveredRating(star);
			}
		},
		[interactive],
	);

	const value = showValue ? (
		<span data-slot="rating-value" className={cn(valueVariants({ size }), starClassName)}>
			{formattedRating}
		</span>
	) : null;

	if (!editable) {
		return (
			<div
				ref={ref}
				role="img"
				aria-label={ariaLabel ?? labels.value(rating.toFixed(RATING_VALUE_FRACTION_DIGITS), maxRating)}
				data-slot="rating"
				className={cn(ratingVariants({ size, state }), className)}
				{...props}>
				<div className="flex items-center">
					{stars.map((star): React.JSX.Element => (
						<span key={star} className="relative">
							<RatingStarGlyphs size={size} fillPercent={starFillPercent(star, displayRating)} />
						</span>
					))}
				</div>
				{value}
			</div>
		);
	}

	return (
		<div
			ref={ref}
			role="radiogroup"
			aria-label={ariaLabel ?? labels.ariaLabel}
			aria-invalid={ariaInvalid}
			aria-disabled={disabled || undefined}
			data-slot="rating"
			data-editable=""
			className={cn(ratingVariants({ size, state }), className)}
			{...props}>
			<div className="flex items-center">
				{stars.map((star): React.JSX.Element => (
					<RatingStarButton
						key={star}
						star={star}
						maxRating={maxRating}
						size={size}
						fillPercent={starFillPercent(star, displayRating)}
						checked={star === checkedStar}
						tabbable={checkedStar >= FIRST_STAR ? star === checkedStar : star === FIRST_STAR}
						disabled={disabled}
						label={labels.star(star, maxRating)}
						onSelect={handleSelect}
						onHover={handleHover}
						registerButton={registerButton}
					/>
				))}
			</div>
			{value}
		</div>
	);
});

export { Rating, ratingVariants };
export type { RatingProps };
