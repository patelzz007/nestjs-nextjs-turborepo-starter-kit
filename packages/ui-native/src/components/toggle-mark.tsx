// A checkbox's tick or a radio's dot, popping in when chosen and shrinking away when cleared
// (TOGGLE_MARK_MS). `ToggleMarkScope` is the control's indicator box: the marks already shown when it
// first draws stay still, and only a change animates. Both follow the OS Reduce Motion setting.

import { cva } from "class-variance-authority";
import * as React from "react";
import { View, type ViewInstance } from "react-native";
import Animated, { LayoutAnimationConfig, ReduceMotion, ZoomIn, ZoomOut } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { TOGGLE_MARK_MS } from "../lib/motion";

const StyledAnimatedView = withUniwind(Animated.View);

const MARK_ENTERING = ZoomIn.duration(TOGGLE_MARK_MS.enter).reduceMotion(ReduceMotion.System);
const MARK_EXITING = ZoomOut.duration(TOGGLE_MARK_MS.exit).reduceMotion(ReduceMotion.System);

/** The mark: its glyph (or, for a radio's dot, its own fill) centred. */
export const toggleMarkVariants = cva("items-center justify-center");

/** The indicator box the mark sits in; the control gives its own shape and colours. */
export const toggleMarkScopeVariants = cva("items-center justify-center");

export interface ToggleMarkProps {
	/** What the mark draws (a glyph); none for a mark that is all fill (a radio's dot). */
	readonly children?: React.ReactNode;
	/** Extra classes, merged last (a radio's dot: its size and fill). */
	readonly className?: string | undefined;
}

/** The mark itself: mount it while chosen, and it animates in and out. */
export const ToggleMark = React.memo(
	React.forwardRef<ViewInstance, ToggleMarkProps>(function ToggleMark({ children, className }, ref): React.JSX.Element {
		return (
			<StyledAnimatedView ref={ref} entering={MARK_ENTERING} exiting={MARK_EXITING} className={cn(toggleMarkVariants(), className)}>
				{children}
			</StyledAnimatedView>
		);
	}),
);

export interface ToggleMarkScopeProps {
	/** The mark, while one is shown. */
	readonly children?: React.ReactNode;
	/** The control's indicator box (a checkbox's square, a radio's ring), merged last. */
	readonly className?: string | undefined;
}

/** The indicator box: marks shown on its first draw don't animate; every later change does. */
export const ToggleMarkScope = React.memo(
	React.forwardRef<ViewInstance, ToggleMarkScopeProps>(function ToggleMarkScope({ children, className }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(toggleMarkScopeVariants(), className)}>
				<LayoutAnimationConfig skipEntering>{children}</LayoutAnimationConfig>
			</View>
		);
	}),
);
