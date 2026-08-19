"use client";

import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import type { TooltipValueType } from "recharts";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES: Readonly<{ light: string; dark: string }> = { light: "", dark: ".dark" };

const THEME_ENTRIES: readonly (readonly [keyof typeof THEMES, string])[] = [
	["light", THEMES.light],
	["dark", THEMES.dark],
];

const INITIAL_DIMENSION: Readonly<{ width: number; height: number }> = { width: 320, height: 200 };
type TooltipNameType = number | string;

type ChartSeriesColor = {
	readonly color: string;
};

type ChartSeriesTheme = {
	readonly theme: Record<"light" | "dark", string>;
};

export type ChartConfig = Record<
	string,
	{
		label?: React.ReactNode;
		icon?: React.ComponentType;
	} & (ChartSeriesColor | ChartSeriesTheme)
>;

interface ChartContextProps {
	config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart(): ChartContextProps {
	const context = React.useContext(ChartContext);

	if (!context) {
		throw new Error("useChart must be used within a <ChartContainer />");
	}

	return context;
}

const ChartContainer = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		config: ChartConfig;
		children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
		initialDimension?: {
			width: number;
			height: number;
		};
	}
>(function ChartContainer({ id, className, children, config, initialDimension = INITIAL_DIMENSION, ...props }, ref): React.JSX.Element {
	const uniqueId = React.useId();
	const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

	return (
		<ChartContext.Provider value={{ config }}>
			<div
				ref={ref}
				data-slot="chart"
				data-chart={chartId}
				className={cn(
					"flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
					className,
				)}
				{...props}>
				<ChartStyle id={chartId} config={config} />
				<RechartsPrimitive.ResponsiveContainer initialDimension={initialDimension}>{children}</RechartsPrimitive.ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	);
});

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }): React.JSX.Element | null => {
	const colorConfig = Object.entries(config).filter(([, itemConfig]) => "theme" in itemConfig || "color" in itemConfig);

	if (!colorConfig.length) {
		return null;
	}

	return (
		<style
			dangerouslySetInnerHTML={{
				__html: THEME_ENTRIES.map(
					([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
	.map(([key, itemConfig]) => {
		const color =
			"theme" in itemConfig && itemConfig.theme !== undefined
				? itemConfig.theme[theme]
				: "color" in itemConfig
					? itemConfig.color
					: undefined;
		return color ? `  --color-${key}: ${color};` : null;
	})
	.join("\n")}
}
`,
				).join("\n"),
			}}
		/>
	);
};

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent({
	active,
	payload,
	className,
	indicator = "dot",
	hideLabel = false,
	hideIndicator = false,
	label,
	labelFormatter,
	labelClassName,
	formatter,
	color,
	nameKey,
	labelKey,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
	React.ComponentProps<"div"> & {
		hideLabel?: boolean;
		hideIndicator?: boolean;
		indicator?: "line" | "dot" | "dashed";
		nameKey?: string;
		labelKey?: string;
	} & Omit<RechartsPrimitive.DefaultTooltipContentProps<TooltipValueType, TooltipNameType>, "accessibilityLayer">): React.JSX.Element | null {
	const { config } = useChart();

	const tooltipLabel = React.useMemo((): React.ReactNode => {
		if (hideLabel || !payload?.length) {
			return null;
		}

		const [item] = payload;
		const key = toDisplayKey(labelKey ?? item?.dataKey ?? item?.name ?? "value");
		const itemConfig = getPayloadConfigFromPayload(config, item, key);
		const value = !labelKey && typeof label === "string" ? (config[label]?.label ?? label) : itemConfig?.label;

		if (labelFormatter) {
			return <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>;
		}

		if (!value) {
			return null;
		}

		return <div className={cn("font-medium", labelClassName)}>{value}</div>;
	}, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

	if (!active || !payload?.length) {
		return null;
	}

	const nestLabel = payload.length === 1 && indicator !== "dot";

	return (
		<div className={cn("grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl", className)}>
			{!nestLabel ? tooltipLabel : null}
			<div className="grid gap-1.5">
				{payload
					.filter((item) => item.type !== "none")
					.map((item, index) => {
						const key = toDisplayKey(nameKey ?? item.name ?? item.dataKey ?? "value");
						const itemConfig = getPayloadConfigFromPayload(config, item, key);
						const indicatorColor = color ?? item.fill ?? item.color;
						const indicatorStyle: React.CSSProperties & Record<`--${string}`, string | undefined> = {
							"--color-bg": indicatorColor,
							"--color-border": indicatorColor,
						};

						return (
							<div
								key={key}
								className={cn("flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground", indicator === "dot" && "items-center")}>
								{formatter && item.value !== undefined && item.name ? (
									formatter(item.value, item.name, item, index, payload)
								) : (
									<>
										{itemConfig?.icon ? (
											<itemConfig.icon />
										) : (
											!hideIndicator && (
												<div
													className={cn("shrink-0 rounded-xs border-(--color-border) bg-(--color-bg)", {
														"h-2.5 w-2.5": indicator === "dot",
														"w-1": indicator === "line",
														"w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
														"my-0.5": nestLabel && indicator === "dashed",
													})}
													style={indicatorStyle}
												/>
											)
										)}
										<div className={cn("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center")}>
											<div className="grid gap-1.5">
												{nestLabel ? tooltipLabel : null}
												<span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
											</div>
											{item.value != null ? (
												<span className="font-mono font-medium text-foreground tabular-nums">
													{typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)}
												</span>
											) : null}
										</div>
									</>
								)}
							</div>
						);
					})}
			</div>
		</div>
	);
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
	className,
	hideIcon = false,
	payload,
	position = "bottom",
	nameKey,
}: React.ComponentProps<"div"> & {
	hideIcon?: boolean;
	nameKey?: string;
	position?: "top" | "bottom";
} & RechartsPrimitive.DefaultLegendContentProps): React.JSX.Element | null {
	const { config } = useChart();

	if (!payload?.length) {
		return null;
	}

	return (
		<div className={cn("flex items-center justify-center gap-4", position === "top" ? "pb-3" : "pt-3", className)}>
			{payload
				.filter((item) => item.type !== "none")
				.map((item) => {
					const key = toDisplayKey(nameKey ?? item.dataKey ?? "value");
					const itemConfig = getPayloadConfigFromPayload(config, item, key);

					return (
						<div key={key} className={cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground")}>
							{itemConfig?.icon && !hideIcon ? (
								<itemConfig.icon />
							) : (
								<div
									className="h-2 w-2 shrink-0 rounded-xs"
									style={{
										backgroundColor: item.color,
									}}
								/>
							)}
							{itemConfig?.label}
						</div>
					);
				})}
		</div>
	);
}

function toDisplayKey(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number") {
		return String(value);
	}
	return "value";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string): ChartConfig[string] | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}

	const payloadPayload: unknown = payload.payload;

	let configLabelKey: string = key;

	if (typeof payload[key] === "string") {
		configLabelKey = payload[key];
	} else if (isRecord(payloadPayload) && typeof payloadPayload[key] === "string") {
		configLabelKey = payloadPayload[key];
	}

	return configLabelKey in config ? config[configLabelKey] : config[key];
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
