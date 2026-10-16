"use client";

import type * as React from "react";
import { ClockIcon, GlobeIcon, LayersIcon, TerminalIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Environment {
	readonly value: string;
	readonly label: string;
	readonly icon: React.JSX.Element;
}

const environments: readonly Environment[] = [
	{
		value: "production",
		label: "Production",
		icon: <GlobeIcon aria-hidden="true" className="size-3.5 opacity-60" />,
	},
	{
		value: "staging",
		label: "Staging",
		icon: <LayersIcon aria-hidden="true" className="size-3.5 opacity-60" />,
	},
	{
		value: "development",
		label: "Development",
		icon: <TerminalIcon aria-hidden="true" className="size-3.5 opacity-60" />,
	},
];

interface TimeRange {
	readonly value: string;
	readonly label: string;
	readonly category: "recent" | "plus";
}

const timeRanges: readonly TimeRange[] = [
	{ value: "1h", label: "Last hour", category: "recent" },
	{ value: "6h", label: "Last 6 hours", category: "recent" },
	{ value: "12h", label: "Last 12 hours", category: "recent" },
	{ value: "24h", label: "Last 24 hours", category: "recent" },
	{ value: "3d", label: "Last 3 days", category: "plus" },
	{ value: "7d", label: "Last 7 days", category: "plus" },
	{ value: "14d", label: "Last 14 days", category: "plus" },
	{ value: "30d", label: "Last 30 days", category: "plus" },
];

const RECENT_RANGES: readonly TimeRange[] = timeRanges.filter((range) => range.category === "recent");
const PLUS_RANGES: readonly TimeRange[] = timeRanges.filter((range) => range.category === "plus");

const DEFAULT_ENVIRONMENT = "development";
const DEFAULT_RANGE = "12h";

function formatEnvironment(value: string): React.ReactNode {
	const environment = environments.find((item) => item.value === value);
	if (environment === undefined) {
		return value;
	}
	return (
		<span className="flex items-center gap-2">
			{environment.icon}
			<span>{environment.label}</span>
		</span>
	);
}

function formatRange(value: string): React.ReactNode {
	const range = timeRanges.find((item) => item.value === value);
	return (
		<span className="flex items-center gap-2">
			<ClockIcon aria-hidden="true" className="size-3.5 opacity-60" />
			<span>{range?.label ?? value}</span>
		</span>
	);
}

export function ButtonGroup33Example(): React.JSX.Element {
	const [env, setEnv] = useState<string | null>(DEFAULT_ENVIRONMENT);
	const [range, setRange] = useState<string | null>(DEFAULT_RANGE);

	const handleEnvChange = useCallback((value: string | null): void => {
		setEnv(value);
	}, []);
	const handleRangeChange = useCallback((value: string | null): void => {
		setRange(value);
	}, []);

	return (
		<ButtonGroup>
			<Select value={env} onValueChange={handleEnvChange} items={environments}>
				<SelectTrigger className="w-40">
					<SelectValue formatValue={formatEnvironment} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false} align="start">
					<SelectGroup>
						{environments.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								<div className="flex items-center gap-2">
									{item.icon}
									<span>{item.label}</span>
								</div>
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>

			<Select value={range} onValueChange={handleRangeChange} items={timeRanges}>
				<SelectTrigger className="w-40">
					<SelectValue formatValue={formatRange} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{RECENT_RANGES.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
					<SelectSeparator />
					<SelectGroup>
						<SelectLabel>Observability Plus</SelectLabel>
						{PLUS_RANGES.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</ButtonGroup>
	);
}
