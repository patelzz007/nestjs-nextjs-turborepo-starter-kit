"use client";

import { cn } from "@workspace/ui/lib/utils";
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
		const color = "theme" in itemConfig ? itemConfig.theme[theme] : itemConfig.color;
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
		<div className={cn("grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl", className)}>
			{!nestLabel ? tooltipLabel : null}
			<div className="grid gap-1.5">
				{payload
					.filter((item) => item.type !== "none")
					.map((item, index) => {
						const key = resolveDisplayKey(nameKey, item.name, item.dataKey, "value");
						const itemConfig = resolvePayloadConfig(config, item, key);
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
					const key = resolveDisplayKey(nameKey, item.dataKey, "value");
					const itemConfig = resolvePayloadConfig(config, item, key);

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

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
