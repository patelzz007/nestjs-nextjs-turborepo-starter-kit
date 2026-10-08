"use client";

import { isNumberPrimitive } from "@workspace/shared";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import type { TooltipValueType } from "recharts";
import { z } from "zod";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES: Readonly<{ light: string; dark: string }> = { light: "", dark: ".dark" };

const THEME_ENTRIES: readonly (readonly [keyof typeof THEMES, string])[] = [
	["light", THEMES.light],
	["dark", THEMES.dark],
];

const INITIAL_DIMENSION: Readonly<{ width: number; height: number }> = { width: 320, height: 200 };
type TooltipNameType = number | string;

interface ChartSeriesColor {
	readonly color: string;
}

interface ChartSeriesTheme {
	readonly theme: Record<"light" | "dark", string>;
}

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
	const contextValue = React.useMemo((): ChartContextProps => ({ config }), [config]);

	return (
		<ChartContext.Provider value={contextValue}>
			<div
				ref={ref}
				data-slot="chart"
				data-chart={chartId}
				className={cn(
					"flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
					className,
				)}
				{...props}>
				{/* The selectors above match recharts' default `#ccc` / `#fff` stroke attributes in order to restyle them with tokens; they apply no hex colour. */}
				<ChartStyle id={chartId} config={config} />
				<RechartsPrimitive.ResponsiveContainer initialDimension={initialDimension}>{children}</RechartsPrimitive.ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	);
});

interface ChartStyleProps {
	readonly id: string;
	readonly config: ChartConfig;
}

/** Builds the per-theme `--color-<key>` declarations of a chart's series; `undefined` when no series has a colour. */
function buildChartStyleHtml(id: string, config: ChartConfig): string | undefined {
	const colorConfig = Object.entries(config).filter(([, itemConfig]) => "theme" in itemConfig || "color" in itemConfig);

	if (!colorConfig.length) {
		return undefined;
	}

	return THEME_ENTRIES.map(
		([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
	.map(([key, itemConfig]) => {
		const color = "theme" in itemConfig ? itemConfig.theme[theme] : itemConfig.color;
		return color ? `  --color-${key}: ${color};` : null;
	})
	.join("\n")}
}
`,
	).join("\n");
}

type StyleInnerHtml = React.DOMAttributes<HTMLStyleElement>["dangerouslySetInnerHTML"];

/** The scoped `<style>` that maps a chart's series keys to their theme colours. */
const ChartStyle = React.forwardRef<HTMLStyleElement, ChartStyleProps>(function ChartStyle({ id, config }, ref): React.JSX.Element | null {
	const innerHtml = React.useMemo((): StyleInnerHtml => {
		const html = buildChartStyleHtml(id, config);
		return html === undefined ? undefined : { __html: html };
	}, [id, config]);

	if (innerHtml === undefined) {
		return null;
	}

	return <style ref={ref} dangerouslySetInnerHTML={innerHtml} />;
});

const ChartTooltip = RechartsPrimitive.Tooltip;

function formatTooltipNumber(value: number, valueFormatter: ((value: number) => string) | undefined): string {
	return valueFormatter === undefined ? value.toLocaleString() : valueFormatter(value);
}

type ChartTooltipContentProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
	React.ComponentProps<"div"> & {
		hideLabel?: boolean;
		hideIndicator?: boolean;
		indicator?: "line" | "dot" | "dashed";
		nameKey?: string;
		labelKey?: string;
		/** Renders numeric values (e.g. money in minor units); defaults to `toLocaleString()`. */
		valueFormatter?: (value: number) => string;
	} & Omit<RechartsPrimitive.DefaultTooltipContentProps<TooltipValueType, TooltipNameType>, "accessibilityLayer">;

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(function ChartTooltipContent(
	{
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
		valueFormatter,
	},
	ref,
): React.JSX.Element | null {
	const { config } = useChart();

	const tooltipLabel = React.useMemo((): React.ReactNode => {
		if (hideLabel || !payload?.length) {
			return null;
		}

		const [item] = payload;
		const key = resolveDisplayKey(labelKey, item?.dataKey, item?.name, "value");
		const itemConfig = resolvePayloadConfig(config, item, key);
		const labelStringParsed = z.string().safeParse(label);
		const value = !labelKey && labelStringParsed.success ? (config[labelStringParsed.data]?.label ?? labelStringParsed.data) : itemConfig?.label;

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
		<div ref={ref} className={cn("grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl", className)}>
			{!nestLabel ? tooltipLabel : null}
			<div className="grid gap-1.5">
				{payload
					.filter((item) => item.type !== "none")
					.map((item, index) => {
						const key = resolveDisplayKey(nameKey, item.name, item.dataKey, "value");
						const itemConfig = resolvePayloadConfig(config, item, key);
						const indicatorColor = color ?? item.fill ?? item.color;

						return (
							<div
								key={key}
								className={cn("flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground", indicator === "dot" && "items-center")}>
								{formatter && item.value !== undefined && item.name ? (
									formatter(item.value, item.name, item, index, payload)
								) : (
									<>
										{itemConfig?.icon ? <itemConfig.icon /> : !hideIndicator && <TooltipIndicator color={indicatorColor} indicator={indicator} nestLabel={nestLabel} />}
										<div className={cn("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center")}>
											<div className="grid gap-1.5">
												{nestLabel ? tooltipLabel : null}
												<span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
											</div>
											{item.value != null ? (
												<span className="font-mono font-medium text-foreground tabular-nums">
													{isNumberPrimitive(item.value) ? formatTooltipNumber(item.value, valueFormatter) : String(item.value)}
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
});

type TooltipIndicatorStyle = React.CSSProperties & Record<`--${string}`, string | undefined>;

interface TooltipIndicatorProps {
	readonly color: string | undefined;
	readonly indicator: "line" | "dot" | "dashed";
	readonly nestLabel: boolean;
}

/** The series key of one tooltip row; its style object is rebuilt only when the colour changes. */
function TooltipIndicator({ color, indicator, nestLabel }: TooltipIndicatorProps): React.JSX.Element {
	const style = React.useMemo((): TooltipIndicatorStyle => ({ "--color-bg": color, "--color-border": color }), [color]);
	return (
		<div
			className={cn("shrink-0 rounded-xs border-(--color-border) bg-(--color-bg)", {
				"size-2.5": indicator === "dot",
				"w-1": indicator === "line",
				"w-0 border-(length:--chart-indicator-dashed-width) border-dashed bg-transparent": indicator === "dashed",
				"my-0.5": nestLabel && indicator === "dashed",
			})}
			style={style}
		/>
	);
}

const ChartLegend = RechartsPrimitive.Legend;

type ChartLegendContentProps = React.ComponentProps<"div"> & {
	hideIcon?: boolean;
	nameKey?: string;
	position?: "top" | "bottom";
} & RechartsPrimitive.DefaultLegendContentProps;

const ChartLegendContent = React.forwardRef<HTMLDivElement, ChartLegendContentProps>(function ChartLegendContent(
	{ className, hideIcon = false, payload, position = "bottom", nameKey },
	ref,
): React.JSX.Element | null {
	const { config } = useChart();

	if (!payload?.length) {
		return null;
	}

	return (
		<div ref={ref} className={cn("flex items-center justify-center gap-4", position === "top" ? "pb-3" : "pt-3", className)}>
			{payload
				.filter((item) => item.type !== "none")
				.map((item) => {
					const key = resolveDisplayKey(nameKey, item.dataKey, "value");
					const itemConfig = resolvePayloadConfig(config, item, key);

					return (
						<div key={key} className={cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground")}>
							{itemConfig?.icon && !hideIcon ? <itemConfig.icon /> : <LegendSwatch color={item.color} />}
							{itemConfig?.label}
						</div>
					);
				})}
		</div>
	);
});

/** The colour square of one legend entry; its style object is rebuilt only when the colour changes. */
function LegendSwatch({ color }: { readonly color: string | undefined }): React.JSX.Element {
	const style = React.useMemo((): React.CSSProperties => ({ backgroundColor: color }), [color]);
	return <div className="size-2 shrink-0 rounded-xs" style={style} />;
}

type ChartPayloadPrimitive = string | number | boolean | null;

interface ChartPayloadRecord {
	readonly [key: string]: ChartPayloadValue | undefined;
}

type ChartPayloadValue = ChartPayloadPrimitive | readonly ChartPayloadValue[] | ChartPayloadRecord;

const ChartPayloadValueSchema: z.ZodType<ChartPayloadValue> = z.lazy(() =>
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(ChartPayloadValueSchema), z.record(z.string(), ChartPayloadValueSchema)]),
);

const ChartPayloadRecordSchema: z.ZodType<ChartPayloadRecord> = z.record(z.string(), ChartPayloadValueSchema);

type DisplayKeyCandidate = string | number | boolean | null | object | undefined;

function parseDisplayKeyCandidate(value: DisplayKeyCandidate): string | undefined {
	const stringParsed = z.string().safeParse(value);
	if (stringParsed.success) {
		return stringParsed.data;
	}
	const numberParsed = z.number().safeParse(value);
	if (numberParsed.success) {
		return String(numberParsed.data);
	}
	return undefined;
}

function resolveDisplayKey(...candidates: DisplayKeyCandidate[]): string {
	for (const candidate of candidates) {
		const parsed = parseDisplayKeyCandidate(candidate);
		if (parsed !== undefined) {
			return parsed;
		}
	}
	return "value";
}

function getPayloadConfigFromPayload(config: ChartConfig, entry: ChartPayloadRecord, key: string): ChartConfig[string] | undefined {
	let configLabelKey: string = key;

	const directKeyParsed = z.string().safeParse(entry[key]);
	if (directKeyParsed.success) {
		configLabelKey = directKeyParsed.data;
	} else {
		const nestedParsed = ChartPayloadRecordSchema.safeParse(entry.payload);
		if (nestedParsed.success) {
			const nestedKeyParsed = z.string().safeParse(nestedParsed.data[key]);
			if (nestedKeyParsed.success) {
				configLabelKey = nestedKeyParsed.data;
			}
		}
	}

	return configLabelKey in config ? config[configLabelKey] : config[key];
}

function resolvePayloadConfig(config: ChartConfig, item: object | undefined, key: string): ChartConfig[string] | undefined {
	const entryParsed = ChartPayloadRecordSchema.safeParse(item);
	if (!entryParsed.success) {
		return undefined;
	}
	return getPayloadConfigFromPayload(config, entryParsed.data, key);
}

export {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
	ChartStyle,
	type ChartStyleProps,
	type ChartTooltipContentProps,
	type ChartLegendContentProps,
};
