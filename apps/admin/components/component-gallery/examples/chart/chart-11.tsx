"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import { m, type MotionStyle, type TargetAndTransition, type Transition } from "framer-motion";
import { LazyMotionProvider } from "@workspace/ui/components/lazy-motion";
import { TrendingUpIcon } from "lucide-react";
import * as React from "react";
import { Bar, BarChart, type BarShapeProps, type Margin, XAxis } from "recharts";

import { abbreviateMonth, formatMonthTooltipLabel, formatUsd } from "@/components/component-gallery/examples/chart/chart-example-format";

// Every bar rests as a thin pill; hovering one springs it to full width and
// floats its value above it, and the headline shows that month's figure.

/** Width of a bar that is not hovered (px). */
const COLLAPSED_BAR_WIDTH_PX = 6;
/** Corner radius of every bar (px). */
const BAR_CORNER_RADIUS_PX = 3;
/** Gap between a hovered bar's top and its value label (px). */
const VALUE_LABEL_GAP_PX = 5;
/** The headline figure while no bar is hovered. */
const RESTING_HEADLINE_VALUE = 123;

const EXPAND_TRANSITION: Transition = { type: "spring", duration: 0.5 };
const COLLAPSE_TRANSITION: Transition = { type: "spring", duration: 1 };
const LABEL_TRANSITION: Transition = { duration: 0.1 };
const BAR_STYLE: MotionStyle = { willChange: "transform, width" };
const LABEL_STYLE: MotionStyle = { willChange: "transform, opacity" };
const LABEL_HIDDEN: TargetAndTransition = { opacity: 0, y: -10, filter: "blur(3px)" };
const LABEL_SHOWN: TargetAndTransition = { opacity: 1, y: 0, filter: "blur(0px)" };

const CHART_MARGIN: Partial<Margin> = { top: 20, right: 12, bottom: 12, left: 12 };

const chartData = [
	{ month: "January", desktop: 289 },
	{ month: "February", desktop: 345 },
	{ month: "March", desktop: 412 },
	{ month: "April", desktop: 478 },
	{ month: "May", desktop: 534 },
	{ month: "June", desktop: 456 },
	{ month: "July", desktop: 523 },
	{ month: "August", desktop: 589 },
	{ month: "September", desktop: 467 },
	{ month: "October", desktop: 398 },
	{ month: "November", desktop: 356 },
	{ month: "December", desktop: 423 },
];

const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--chart-4)",
	},
} satisfies ChartConfig;

interface AnimatedBarProps {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly index: number;
	readonly label: string;
	readonly isActive: boolean;
	readonly onActivate: (index: number) => void;
}

function AnimatedBar({ x, y, width, height, index, label, isActive, onActivate }: AnimatedBarProps): React.JSX.Element {
	// A collapsed bar stays centred in its slot; the hovered one fills it.
	const barX = isActive ? x : x + (width - COLLAPSED_BAR_WIDTH_PX) / 2;
	const initial = React.useMemo((): TargetAndTransition => ({ width: COLLAPSED_BAR_WIDTH_PX, x: barX }), [barX]);
	const animate = React.useMemo((): TargetAndTransition => ({ width: isActive ? width : COLLAPSED_BAR_WIDTH_PX, x: barX }), [barX, isActive, width]);
	const handleMouseEnter = React.useCallback((): void => {
		onActivate(index);
	}, [index, onActivate]);

	return (
		<g onMouseEnter={handleMouseEnter}>
			<m.rect
				style={BAR_STYLE}
				y={y}
				initial={initial}
				animate={animate}
				transition={isActive ? EXPAND_TRANSITION : COLLAPSE_TRANSITION}
				height={height}
				fill="var(--color-desktop)"
				rx={BAR_CORNER_RADIUS_PX}
			/>
			{isActive ? (
				<m.text
					style={LABEL_STYLE}
					className="font-mono"
					initial={LABEL_HIDDEN}
					animate={LABEL_SHOWN}
					exit={LABEL_HIDDEN}
					transition={LABEL_TRANSITION}
					x={x + width / 2}
					y={y - VALUE_LABEL_GAP_PX}
					textAnchor="middle"
					fill="var(--color-desktop)">
					{label}
				</m.text>
			) : null}
		</g>
	);
}

export function Chart11Example(): React.JSX.Element {
	const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined);
	const activeMonth = activeIndex === undefined ? undefined : chartData[activeIndex];

	const handleMouseLeave = React.useCallback((): void => {
		setActiveIndex(undefined);
	}, []);

	const renderBar = React.useCallback(
		({ x, y, width, height, index }: BarShapeProps): React.JSX.Element => (
			<AnimatedBar
				x={x}
				y={y}
				width={width}
				height={height}
				index={index}
				label={String(chartData[index]?.desktop ?? "")}
				isActive={index === activeIndex}
				onActivate={setActiveIndex}
			/>
		),
		[activeIndex],
	);

	return (
		<LazyMotionProvider>
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Conversion Rates
						<span className="ml-auto font-mono text-xl tracking-tighter">{formatUsd(activeMonth?.desktop ?? RESTING_HEADLINE_VALUE)}</span>
						<Badge variant="success-light">
							<TrendingUpIcon aria-hidden="true" />
							<span>5.2%</span>
						</Badge>
					</CardTitle>
					<CardDescription>Real-time funnel conversion tracking</CardDescription>
				</CardHeader>
				<CardContent>
					<ChartContainer config={chartConfig}>
						<BarChart accessibilityLayer data={chartData} onMouseLeave={handleMouseLeave} margin={CHART_MARGIN}>
							<XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={abbreviateMonth} />
							<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="min-w-40 gap-2.5" labelFormatter={formatMonthTooltipLabel} />} />
							<Bar dataKey="desktop" fill="var(--color-desktop)" shape={renderBar} />
						</BarChart>
					</ChartContainer>
				</CardContent>
			</Card>
		</LazyMotionProvider>
	);
}
