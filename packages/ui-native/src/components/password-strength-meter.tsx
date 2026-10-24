// A password strength meter: a titled badge with the strength's name, a bar
// filled to `percent`, and an optional ✓/✗ checklist of criteria.
// Presentational, as on the web kit (packages/ui → password-strength-meter):
// the CALLER computes the score, the percent and the label (with
// `passwordStrength()` in the app) — the kit never judges a password.
//
// Colours come from the status tokens (destructive → warning → info →
// success), so both themes work. The bar slides to its new width on the
// selection spring, which jumps under Reduce Motion (lib/motion.ts).

import { cva, type VariantProps } from "class-variance-authority";
import CircleCheckBigIcon from "lucide-react-native/icons/circle-check-big";
import CircleXIcon from "lucide-react-native/icons/circle-x";
import ShieldIcon from "lucide-react-native/icons/shield";
import ShieldAlertIcon from "lucide-react-native/icons/shield-alert";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import * as React from "react";
import { type LayoutChangeEvent, Text, View, type ViewInstance } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { SELECTION_SPRING } from "../lib/motion";
import { Icon, type LucideIcon } from "./icon";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

/** The bar reports `percent` on a 0–100 scale. */
const PERCENT_MIN = 0;
const PERCENT_MAX = 100;

export const passwordStrengthMeterVariants = cva("", {
	variants: {
		variant: {
			default: "",
		},
		/** `sm`: a tighter meter under a compact field. */
		size: {
			sm: "gap-1.5",
			md: "gap-2",
		},
	},
	defaultVariants: { variant: "default", size: "md" },
});

export const passwordStrengthTrackVariants = cva("overflow-hidden rounded-full bg-muted", {
	variants: {
		size: {
			sm: "h-1",
			md: "h-1.5",
		},
	},
	defaultVariants: { size: "md" },
});

/** The filled part of the bar, one status colour per tier. */
export const passwordStrengthBarVariants = cva("h-full rounded-full", {
	variants: {
		tone: {
			weak: "bg-destructive",
			fair: "bg-warning",
			good: "bg-info",
			strong: "bg-success",
		},
	},
	defaultVariants: { tone: "weak" },
});

/** The badge naming the strength. */
export const passwordStrengthBadgeVariants = cva("flex-row items-center gap-1.5 rounded-full px-2 py-0.5", {
	variants: {
		tone: {
			weak: "bg-destructive-soft",
			fair: "bg-warning-soft",
			good: "bg-info-soft",
			strong: "bg-success-soft",
		},
	},
	defaultVariants: { tone: "weak" },
});

export const passwordStrengthBadgeTextVariants = cva("font-sans-medium text-xs", {
	variants: {
		tone: {
			weak: "text-destructive-foreground",
			fair: "text-warning-foreground",
			good: "text-info-foreground",
			strong: "text-success-foreground",
		},
	},
	defaultVariants: { tone: "weak" },
});

type MeterVariantProps = VariantProps<typeof passwordStrengthMeterVariants>;
export type PasswordStrengthMeterVariant = NonNullable<MeterVariantProps["variant"]>;
export type PasswordStrengthMeterSize = NonNullable<MeterVariantProps["size"]>;
export type PasswordStrengthTone = NonNullable<VariantProps<typeof passwordStrengthBarVariants>["tone"]>;

interface ToneGlyph {
	readonly icon: LucideIcon;
	/** An `accent-*` token utility. */
	readonly colorClassName: string;
}

const TONE_GLYPHS: Readonly<Record<PasswordStrengthTone, ToneGlyph>> = {
	weak: { icon: ShieldAlertIcon, colorClassName: "accent-destructive-foreground" },
	fair: { icon: ShieldIcon, colorClassName: "accent-warning-foreground" },
	good: { icon: ShieldCheckIcon, colorClassName: "accent-info-foreground" },
	strong: { icon: ShieldCheckIcon, colorClassName: "accent-success-foreground" },
};

/** The lowest score of each tier above `weak` (the web kit's 0–4 scale: 0 and 1 are both weak). */
const FAIR_MIN_SCORE = 2;
const GOOD_MIN_SCORE = 3;
const STRONG_MIN_SCORE = 4;

/** The tier a 0–4 score falls in. */
export function strengthToneOf(score: number): PasswordStrengthTone {
	if (score >= STRONG_MIN_SCORE) {
		return "strong";
	}
	if (score >= GOOD_MIN_SCORE) {
		return "good";
	}
	return score >= FAIR_MIN_SCORE ? "fair" : "weak";
}

function clampPercent(percent: number): number {
	return Math.min(PERCENT_MAX, Math.max(PERCENT_MIN, percent));
}

export interface PasswordStrengthCriterion {
	/** Human-readable criterion (the caller's copy). */
	readonly label: string;
	/** Whether the password meets it now. */
	readonly met: boolean;
}

export interface PasswordStrengthMeterProps {
	/** 0–4 (0 = empty / very weak, 4 = strong). */
	readonly score: number;
	/** The score's name ("Good"). */
	readonly label: string;
	/** 0–100: how far the bar is filled. At 0 the meter renders nothing. */
	readonly percent: number;
	/** Every criterion with whether it is met: the ✓/✗ checklist. */
	readonly criteria?: readonly PasswordStrengthCriterion[] | undefined;
	/** Unmet criteria shown as ✗ rows, when `criteria` is not given (the web kit's legacy prop). */
	readonly missing?: readonly string[] | undefined;
	/** The heading beside the badge; also prefixes the bar's accessible name. */
	readonly title?: string | undefined;
	/** What screen readers say after a met criterion. */
	readonly metLabel?: string | undefined;
	/** What screen readers say after an unmet criterion. */
	readonly unmetLabel?: string | undefined;
	readonly variant?: PasswordStrengthMeterVariant | undefined;
	readonly size?: PasswordStrengthMeterSize | undefined;
	/** Extra classes for the container, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const EMPTY_MISSING: readonly string[] = [];

export const PasswordStrengthMeter = React.memo(
	React.forwardRef<ViewInstance, PasswordStrengthMeterProps>(function PasswordStrengthMeter(
		{
			score,
			label,
			percent,
			criteria,
			missing = EMPTY_MISSING,
			title = "Password strength",
			metLabel = "Met",
			unmetLabel = "Not met",
			variant = "default",
			size = "md",
			className,
			testID,
		},
		ref,
	): React.JSX.Element | null {
		const filled = clampPercent(percent);
		// The track's measured width (display state): the fill is a share of it, in points.
		const [trackWidth, setTrackWidth] = React.useState(0);
		const fillWidth = useSharedValue(0);
		const hasMeasured = React.useRef(false);
		React.useEffect((): void => {
			const target = (trackWidth * filled) / PERCENT_MAX;
			// The first measurement places the fill; only later changes slide it.
			fillWidth.set(hasMeasured.current ? withSpring(target, SELECTION_SPRING) : target);
			hasMeasured.current = trackWidth > 0;
		}, [filled, fillWidth, trackWidth]);
		const measureTrack = React.useCallback((event: LayoutChangeEvent): void => {
			setTrackWidth(event.nativeEvent.layout.width);
		}, []);
		const fillStyle = useAnimatedStyle(() => ({ width: fillWidth.get() }));
		const accessibilityValue = React.useMemo(() => ({ min: PERCENT_MIN, max: PERCENT_MAX, now: filled, text: label }), [filled, label]);

		if (filled <= PERCENT_MIN) {
			return null;
		}
		const tone = strengthToneOf(score);
		const glyph = TONE_GLYPHS[tone];
		return (
			<View ref={ref} testID={testID} className={cn(passwordStrengthMeterVariants({ variant, size }), className)}>
				<View accessibilityLiveRegion="polite" className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
					<Text className="font-sans-medium text-xs text-muted-foreground">{title}</Text>
					<View className={passwordStrengthBadgeVariants({ tone })}>
						<Icon icon={glyph.icon} size="sm" colorClassName={glyph.colorClassName} />
						<Text className={passwordStrengthBadgeTextVariants({ tone })}>{label}</Text>
					</View>
				</View>
				<View
					accessible
					accessibilityRole="progressbar"
					accessibilityLabel={`${title}: ${label}`}
					accessibilityValue={accessibilityValue}
					onLayout={measureTrack}
					className={passwordStrengthTrackVariants({ size })}>
					<StyledAnimatedView style={fillStyle} className={passwordStrengthBarVariants({ tone })} />
				</View>
				<StrengthChecklist criteria={criteria} missing={missing} metLabel={metLabel} unmetLabel={unmetLabel} />
			</View>
		);
	}),
);

interface StrengthChecklistProps {
	readonly criteria: readonly PasswordStrengthCriterion[] | undefined;
	readonly missing: readonly string[];
	readonly metLabel: string;
	readonly unmetLabel: string;
}

/** The ✓/✗ rows: every criterion when given, else the unmet ones. */
function StrengthChecklist({ criteria, missing, metLabel, unmetLabel }: StrengthChecklistProps): React.JSX.Element | null {
	const rows = React.useMemo(
		(): readonly PasswordStrengthCriterion[] => criteria ?? missing.map((criterion: string): PasswordStrengthCriterion => ({ label: criterion, met: false })),
		[criteria, missing],
	);
	if (rows.length === 0) {
		return null;
	}
	return (
		<View className="gap-1">
			{rows.map((criterion: PasswordStrengthCriterion): React.JSX.Element => (
				<View key={criterion.label} accessible accessibilityLabel={`${criterion.label}: ${criterion.met ? metLabel : unmetLabel}`} className="flex-row items-center gap-1.5">
					<Icon icon={criterion.met ? CircleCheckBigIcon : CircleXIcon} size="sm" colorClassName={criterion.met ? "accent-success-foreground" : "accent-muted-foreground"} />
					<Text className={cn("min-w-0 shrink font-sans text-xs", criterion.met ? "text-foreground" : "text-muted-foreground")}>{criterion.label}</Text>
				</View>
			))}
		</View>
	);
}
