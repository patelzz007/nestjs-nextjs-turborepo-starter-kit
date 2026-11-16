// A score out of a number of stars (the web kit's `Rating`): shown read only,
// or picked when `onChange` is given. A score between whole stars is drawn to
// the nearest half (3.5 is three full stars and a half). Picking: a tap on a
// star sets it; with `allowHalf`, each star has a left and a right half to tap.
// `showValue` prints the score after the stars. Screen readers hear the whole
// rating as one adjustable control ("3.5 of 5 stars") that steps by a star, or
// a half with `allowHalf`.

import { cva, type VariantProps } from "class-variance-authority";
import StarIcon from "lucide-react-native/icons/star";
import StarHalfIcon from "lucide-react-native/icons/star-half";
import * as React from "react";
import { type AccessibilityActionEvent, Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type IconSize } from "./icon";

export const ratingVariants = cva("flex-row items-center self-start", {
	variants: {
		size: { sm: "gap-0.5", md: "gap-1", lg: "gap-1.5" },
		state: { default: "", disabled: "opacity-60" },
	},
	defaultVariants: { size: "md", state: "default" },
});

export const ratingValueVariants = cva("font-sans-medium text-muted-foreground tabular-nums", {
	variants: { size: { sm: "text-caption ml-1", md: "text-body ml-1.5", lg: "text-body-lg ml-2" } },
	defaultVariants: { size: "md" },
});

export type RatingSize = NonNullable<VariantProps<typeof ratingVariants>["size"]>;

const STAR_SIZE: Readonly<Record<RatingSize, IconSize>> = { sm: "sm", md: "md", lg: "lg" };
const HALF = 0.5;

/** What each star shows for a score: full, half or empty. */
export type StarFill = "full" | "half" | "empty";

/** The fill of each of `max` stars for `value`, rounded to the nearest half. */
export function starFills(value: number, max: number): readonly StarFill[] {
	const rounded = Math.round(value / HALF) * HALF;
	return Array.from({ length: max }, (_star: undefined, index: number): StarFill => {
		if (rounded >= index + 1) {
			return "full";
		}
		return rounded >= index + HALF ? "half" : "empty";
	});
}

/** The default spoken form of a rating; generic and overridable. */
export function defaultRatingText(value: number, max: number): string {
	return `${String(value)} of ${String(max)} stars`;
}

export interface RatingProps {
	/** The score, 0 to `max`. */
	readonly value: number;
	/** Makes the rating pickable: the new score. Left out, the rating is read only. */
	readonly onChange?: ((value: number) => void) | undefined;
	/** How many stars. Default 5. */
	readonly max?: number | undefined;
	/** Lets a pick land on a half star. */
	readonly allowHalf?: boolean | undefined;
	/** Prints the score after the stars, to one decimal. */
	readonly showValue?: boolean | undefined;
	readonly size?: RatingSize | undefined;
	readonly disabled?: boolean | undefined;
	/** The rating's name for screen readers ("Your rating"). */
	readonly accessibilityLabel?: string | undefined;
	/** How the score is spoken (default "3.5 of 5 stars"). */
	readonly formatValue?: ((value: number, max: number) => string) | undefined;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const ADJUSTABLE_ACTIONS: readonly { readonly name: "increment" | "decrement" }[] = [{ name: "increment" }, { name: "decrement" }];

interface StarProps {
	readonly fill: StarFill;
	readonly size: RatingSize;
}

function Star({ fill, size }: StarProps): React.JSX.Element {
	return (
		<View>
			<Icon icon={StarIcon} size={STAR_SIZE[size]} colorClassName={fill === "full" ? "accent-tone-yellow" : "accent-text-tertiary"} filled={fill === "full"} />
			{fill === "half" ? <Icon icon={StarHalfIcon} size={STAR_SIZE[size]} colorClassName="accent-tone-yellow" filled className="absolute top-0 left-0" /> : null}
		</View>
	);
}

interface StarTargetProps {
	readonly score: number;
	readonly onPick: (score: number) => void;
	readonly className: string;
}

/** An invisible tap target over a star or a half of one. */
const StarTarget = React.memo(function StarTarget({ score, onPick, className }: StarTargetProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(score);
	}, [onPick, score]);
	return (
		<Pressable
			accessible={false}
			importantForAccessibility="no"
			accessibilityRole="button"
			accessibilityLabel={`${String(score)} stars`}
			onPress={press}
			className={className}
		/>
	);
});

export const Rating = React.memo(
	React.forwardRef<ViewInstance, RatingProps>(function Rating(
		{ value, onChange, max = 5, allowHalf = false, showValue = false, size = "md", disabled = false, accessibilityLabel, formatValue = defaultRatingText, className, testID },
		ref,
	): React.JSX.Element {
		const editable = onChange !== undefined && !disabled;
		const step = allowHalf ? HALF : 1;
		const pick = React.useCallback(
			(score: number): void => {
				onChange?.(Math.min(max, Math.max(0, score)));
			},
			[max, onChange],
		);
		const onAccessibilityAction = React.useCallback(
			(event: AccessibilityActionEvent): void => {
				if (event.nativeEvent.actionName === "increment") {
					pick(value + step);
				} else if (event.nativeEvent.actionName === "decrement") {
					pick(value - step);
				}
			},
			[pick, step, value],
		);
		const spoken = formatValue(value, max);
		const accessibilityValue = React.useMemo(() => ({ min: 0, max, now: value, text: spoken }), [max, spoken, value]);
		const accessibilityState = React.useMemo(() => ({ disabled }), [disabled]);
		return (
			<View
				ref={ref}
				testID={testID}
				accessible
				accessibilityRole={editable ? "adjustable" : "image"}
				accessibilityLabel={accessibilityLabel === undefined ? spoken : `${accessibilityLabel}, ${spoken}`}
				accessibilityValue={editable ? accessibilityValue : undefined}
				accessibilityState={accessibilityState}
				accessibilityActions={editable ? ADJUSTABLE_ACTIONS : undefined}
				onAccessibilityAction={editable ? onAccessibilityAction : undefined}
				className={cn(ratingVariants({ size, state: disabled ? "disabled" : "default" }), className)}>
				{starFills(value, max).map((fill: StarFill, index: number): React.JSX.Element => (
					<View key={`star-${String(index + 1)}`}>
						<Star fill={fill} size={size} />
						{editable ? (
							<View className="absolute inset-0 flex-row">
								{allowHalf ? <StarTarget score={index + HALF} onPick={pick} className="flex-1" /> : null}
								<StarTarget score={index + 1} onPick={pick} className="flex-1" />
							</View>
						) : null}
					</View>
				))}
				{showValue ? <Text className={ratingValueVariants({ size })}>{value.toFixed(1)}</Text> : null}
			</View>
		);
	}),
);
