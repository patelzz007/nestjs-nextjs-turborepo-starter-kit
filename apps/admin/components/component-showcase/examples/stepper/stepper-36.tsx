"use client";

import type * as React from "react";
import { AnchorIcon, ArrowRightIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";
import { IconTile } from "@workspace/ui/components/icon-tile";
import {
	Stepper,
	StepperContent,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperPanel,
	StepperSeparator,
	StepperTitle,
	StepperTrigger,
	type StepIndicators,
} from "@workspace/ui/components/stepper";
import { cn } from "@workspace/ui/lib/core/utils";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";

/** The step the example opens on. */
const INITIAL_STEP = 3;
/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

interface Detail {
	readonly label: string;
	readonly value: string;
	readonly warning?: boolean;
	readonly badge?: BadgeProps["variant"];
	/** Initials shown in an avatar chip beside the value. */
	readonly initials?: string;
}

interface Stop {
	readonly code: string;
	readonly port: string;
	readonly carrier: string;
	readonly voyage: string;
	readonly terminal: string;
	readonly summary: string;
	readonly details: Detail[];
	readonly progress?: number;
}

const stops: Stop[] = [
	{
		code: "SGSIN",
		port: "Singapore",
		carrier: "Maersk Sealand",
		voyage: "214E",
		terminal: "Tuas",
		summary: "Loaded at Tuas onto Maersk Sealand, voyage 214E, and sailed on 17 May.",
		details: [
			{ label: "Loaded", value: "16 May" },
			{ label: "Departed", value: "17 May" },
			{
				label: "Captain",
				value: "M. Walberg",
				badge: "outline",
				initials: "MW",
			},
			{ label: "B/L", value: "MSK8842A" },
		],
	},
	{
		code: "LKCMB",
		port: "Colombo",
		carrier: "MSC Aurora",
		voyage: "088W",
		terminal: "SAGT",
		summary: "All 4 containers moved to MSC Aurora at SAGT and sailed on 22 May.",
		details: [
			{ label: "Arrived", value: "21 May" },
			{ label: "Departed", value: "22 May" },
			{ label: "Containers", value: "4×40HC", warning: true },
			{ label: "Transship", value: "Done", badge: "success-light" },
		],
	},
	{
		code: "EGPSD",
		port: "Port Said",
		carrier: "MSC Aurora",
		voyage: "088W",
		terminal: "Med Sea",
		summary: "Through the Suez Canal on 26 May at 18 knots, now a day behind.",
		details: [
			{ label: "Passed", value: "26 May" },
			{ label: "Speed", value: "18kn" },
			{ label: "Delay", value: "+1 day", badge: "warning-light" },
		],
		progress: 4,
	},
	{
		code: "NLRTM",
		port: "Rotterdam",
		carrier: "MSC Aurora",
		voyage: "088W",
		terminal: "ECT Delta",
		summary: "Due at ECT Delta on 3 June to unload 1 container once customs clear it.",
		details: [
			{ label: "ETA", value: "03 Jun" },
			{ label: "ETD", value: "04 Jun" },
			{ label: "Unload", value: "1×40HC", warning: true },
			{ label: "Customs", value: "Pending", badge: "secondary" },
		],
	},
	{
		code: "DEHAM",
		port: "Hamburg",
		carrier: "DB Cargo",
		voyage: "4410",
		terminal: "CTA",
		summary: "Due on 6 June, then the last 3 containers go on by DB Cargo train 4410.",
		details: [
			{ label: "ETA", value: "06 Jun" },
			{ label: "ETD", value: "07 Jun" },
			{ label: "Unload", value: "3×40HC", warning: true },
			{ label: "Onward", value: "Rail", badge: "secondary" },
		],
	},
];

const segments = 6;

// The 34px ring stays transparent and the 28px dot inside it carries the
// state color, so the 2px gap between them shows whatever surface is behind.
// The route takes the primary token (the design's blue accent).
function Anchor({ className }: { readonly className: string }): React.JSX.Element {
	return (
		<span className={cn("flex size-7 items-center justify-center rounded-full", className)}>
			<AnchorIcon className="size-3.5" aria-hidden="true" />
		</span>
	);
}

const reached = <Anchor className="bg-primary text-primary-foreground" />;

const indicators: StepIndicators = {
	completed: reached,
	active: reached,
	inactive: <Anchor className="bg-input text-foreground" />,
};

// The leg at sea is a 13px sine period repeated as a mask over a hard-stop
// gradient: primary for the distance sailed, ring for what is left. The style
// radius would clip the wave where it meets the ends, so it is squared off.
const wave =
	"bg-transparent bg-linear-to-r from-primary from-75% to-ring/40 to-75% mask-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220,0,13,8%22%3E%3Cpath%20d=%22M0,4Q3.25,-2.5,6.5,4T13,4%22%20fill=%22none%22%20stroke=%22%23000%22%20stroke-width=%221.5%22/%3E%3C/svg%3E')] mask-size-[0.8125rem_0.5rem] mask-repeat-x rounded-none! rtl:bg-linear-to-l rtl:mask-right group-data-[orientation=horizontal]/stepper-nav:h-2";

function Row({
	label,
	className,
	children,
}: {
	readonly label: React.ReactNode;
	readonly className?: string | undefined;
	readonly children: React.ReactNode;
}): React.JSX.Element {
	return (
		<div className={cn("flex items-center gap-1", className)}>
			<dt className="shrink-0 text-muted-foreground">{label}</dt>
			<dd className="flex min-w-0 flex-1 items-center justify-end gap-1 self-stretch">{children}</dd>
		</div>
	);
}

// Skewed from its top end corner, so the slanted bar finishes flush with the
// values above it and leans forward in either direction.
function LegProgress({ value, to }: { readonly value: number; readonly to: string }): React.JSX.Element {
	return (
		<span
			role="progressbar"
			aria-label={`Progress to ${to}`}
			aria-valuemin={0}
			aria-valuemax={segments}
			aria-valuenow={value}
			className="flex origin-top-right -skew-x-20 gap-0.5 rtl:origin-top-left rtl:skew-x-20">
			{Array.from({ length: segments }, (_, index) => (
				<span key={index} className={cn("h-2 w-2.5 rounded-xs border", index < value ? "border-success/60 bg-success/50" : "border-ring/60 bg-ring/20")} />
			))}
		</span>
	);
}

export function Stepper36Example(): React.JSX.Element {
	const [current, setCurrent] = useState<number>(INITIAL_STEP);
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = current > stops.length;

	const goTo = useCallback((step: number): void => {
		setCurrent(step);
		// The pressed button disables itself at either end, so focus moves to
		// its partner.
		if (step === FIRST_STEP) nextRef.current?.focus();
		if (step > stops.length) prevRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(current - STEP_INCREMENT);
	}, [current, goTo]);

	const goToNextStep = useCallback((): void => {
		goTo(current + STEP_INCREMENT);
	}, [current, goTo]);

	return (
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="@container flex w-full max-w-250 flex-col gap-6" aria-label="Shipment route">
			{/* The route fills its container and sheds detail as it narrows: every
          row from 56rem (the avatar from 58rem), the headers and first two
          rows from 48rem, and below 24rem only the current stop (the last
          once all are done) shows its code. */}
			<StepperNav>
				{stops.map((stop, index) => {
					const step = index + 1;
					const next = stops[index + 1];

					return (
						<StepperItem key={stop.code} step={step} className="min-w-0 items-stretch justify-start group-data-[orientation=horizontal]/stepper-nav:flex-col">
							{/* The header tucks 10px under the track and centers on the
                  span past the indicator. */}
							<div className="-mb-2.5 hidden flex-col items-center gap-1 ps-8.5 whitespace-nowrap @3xl:flex">
								<p className="text-sm font-medium">{stop.carrier}</p>
								<p className="flex items-center gap-1 text-xs font-medium text-primary">
									{stop.voyage}
									<span aria-hidden="true" className="flex w-2.5 justify-center before:h-3 before:w-px before:rotate-45 before:bg-ring/40" />
									{stop.terminal}
								</p>
							</div>

							<div className="flex h-8.5 items-center">
								<StepperTrigger tabIndex={allDone && step === stops.length ? TAB_STOP : undefined} aria-label={stop.port}>
									<StepperIndicator className="size-8.5 border border-input/50 bg-transparent not-data-[state=inactive]:border-primary data-[state=active]:bg-transparent data-[state=completed]:bg-transparent" />
								</StepperTrigger>
								<StepperSeparator className={cn("m-0 bg-ring/20 data-[state=completed]:bg-primary", step === current && wave)} />
							</div>

							<div className="mt-2.5 flex flex-col gap-2 ps-0.5 pe-4">
								<StepperTitle className={cn("whitespace-nowrap", !(allDone && step === stops.length) && "@max-sm:not-data-[state=active]:sr-only")}>{stop.code}</StepperTitle>

								<dl className="hidden flex-col gap-1 text-xs whitespace-nowrap @2xl:flex">
									{stop.details.map((detail, row) => (
										<Row key={detail.label} label={detail.label} className={row > 1 ? "hidden @3xl:flex" : undefined}>
											{/* 2px dashes on a 4px pitch, spaced edge to edge so
                          neither end of the leader clips a dash. */}
											<span
												aria-hidden="true"
												className="mb-1 h-px min-w-1 flex-1 self-end bg-ring/30 mask-[linear-gradient(to_right,transparent_25%,#000_0_75%,transparent_0)] mask-size-[0.25rem_100%] mask-repeat-space"
											/>
											{detail.badge !== undefined ? (
												<Badge variant={detail.badge} radius="full">
													{detail.initials !== undefined ? (
														<Avatar className="hidden size-3 @4xl:flex">
															<AvatarFallback>{detail.initials}</AvatarFallback>
														</Avatar>
													) : null}
													{detail.value}
												</Badge>
											) : (
												// Upcoming stops dim their figures, which stay
												// estimates until the vessel gets there. Counts take
												// the warning token to stay legible on the card.
												<span
													className={cn(
														"truncate font-medium",
														detail.warning ? "text-warning group-data-[state=inactive]/step:text-warning/60" : "group-data-[state=inactive]/step:text-muted-foreground",
													)}>
													{detail.value}
												</span>
											)}
										</Row>
									))}

									{next && stop.progress !== undefined ? (
										<Row
											className="hidden @3xl:flex"
											label={
												<>
													To <span className="font-medium text-foreground">{next.code}</span>
												</>
											}>
											<LegProgress value={stop.progress} to={next.port} />
										</Row>
									) : null}
								</dl>
							</div>
						</StepperItem>
					);
				})}

				{/* The cargo goes on past the last stop, so the route ends in an
            arrow rather than another step. While the header shows, the 30px
            offset (the header less its tuck) levels it with the indicators. */}
				<IconTile radius="full" size="sm" aria-hidden="true" className="[--icon-tile-size:--spacing(8.5)] @3xl:mt-7.5">
					<ArrowRightIcon className="size-3.5 text-muted-foreground rtl:rotate-180" />
				</IconTile>
			</StepperNav>

			<StepperPanel className="text-center">
				{stops.map((stop, index) => (
					<StepperContent key={stop.code} value={index + 1}>
						<p className="text-sm font-medium">{stop.port}</p>
						<p className="text-sm text-muted-foreground">{stop.summary}</p>
					</StepperContent>
				))}
				<StepperContent value={stops.length + 1}>
					<p className="text-sm font-medium">Arrived in Hamburg</p>
					<p className="text-sm text-muted-foreground">Discharged at the terminal, the voyage is complete.</p>
				</StepperContent>
				<div className="mt-3 flex justify-center gap-2">
					<Button ref={prevRef} variant="outline" size="sm" disabled={current === FIRST_STEP} onClick={goToPreviousStep}>
						Previous
					</Button>
					<Button ref={nextRef} variant="outline" size="sm" disabled={allDone} onClick={goToNextStep}>
						Next
					</Button>
				</div>
			</StepperPanel>
		</Stepper>
	);
}
