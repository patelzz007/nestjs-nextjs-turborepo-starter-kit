"use client";

import type * as React from "react";
import { CheckIcon, CircleDashedIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";
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
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@workspace/ui/components/carousel";

/** How far one Previous / Next click moves. */
const STEP_INCREMENT = 1;
const FIRST_STEP = 1;
/** The roving tab stop the last trigger keeps once every step is done. */
const TAB_STOP = 0;

interface Detail {
	readonly label: string;
	readonly value: string;
	readonly badge?: BadgeProps["variant"];
	/** Initials shown in an avatar chip beside the value. */
	readonly initials?: string;
}

interface Stage {
	readonly title: string;
	readonly time: string;
	readonly summary: string;
	readonly details: readonly Detail[];
}

const stages: readonly Stage[] = [
	{
		title: "Loaded",
		time: "15:08",
		summary: "Parcels scanned and loaded at depot B23.",
		details: [
			{ label: "Depot", value: "B23" },
			{
				label: "Agent",
				value: "Mark",
				initials: "M",
			},
		],
	},
	{
		title: "Out",
		time: "15:10",
		summary: "Left the yard through gate A3 on schedule.",
		details: [
			{ label: "Gate", value: "A3" },
			{ label: "Status", value: "On time", badge: "success-light" },
		],
	},
	{
		title: "Transit",
		time: "15:18",
		summary: "On the ring road at 18 km/h, 6 minutes behind plan.",
		details: [
			{ label: "Speed", value: "18 km/h" },
			{ label: "Delay", value: "+6 min", badge: "warning-light" },
		],
	},
	{
		title: "Delivery",
		time: "15:28",
		summary: "Last of 8 stops, arriving in about 5 minutes.",
		details: [
			{ label: "Stop", value: "8/8" },
			{ label: "ETA", value: "5 min", badge: "success-light" },
		],
	},
	{
		title: "Return",
		time: "15:45",
		summary: "Back to depot B23 to charge, battery at 62%.",
		details: [
			{ label: "Depot", value: "B23" },
			{ label: "Battery", value: "62%" },
		],
	},
];

function Pending({ spin = false }: { readonly spin?: boolean }): React.JSX.Element {
	return (
		<span className="flex size-5.5 items-center justify-center rounded-full bg-ring/80 text-background">
			<CircleDashedIcon className={cn("size-3.5", spin && "animate-spin")} aria-hidden="true" />
		</span>
	);
}

// The 26px ring stays transparent and the 22px dot inside it carries the
// state color, so the 1px gap between them shows whatever surface is behind.
const indicators: StepIndicators = {
	completed: (
		<span className="flex size-5.5 items-center justify-center rounded-full bg-success text-success-foreground">
			<CheckIcon className="size-3.5" aria-hidden="true" />
		</span>
	),
	inactive: <Pending />,
	loading: <Pending spin />,
};

// A flex item with no text has its baseline at its bottom edge, so in an
// items-baseline row this dashed rule lands on the text baseline.
function Leader(): React.JSX.Element {
	return <span aria-hidden="true" className="min-w-2 flex-1 border-b border-dashed border-ring/30" />;
}

// 4px dots spaced edge to edge by mask-repeat: space, so a connector at least
// one tile wide never shows a clipped dot. Tiles are in rem, like the box.
const dots =
	"m-0 bg-transparent bg-linear-to-r mask-[radial-gradient(circle_closest-side,#000_90%,transparent)] mask-size-[0.4375rem_0.25rem] mask-repeat-space rtl:bg-linear-to-l group-data-[orientation=horizontal]/stepper-nav:h-1";

const START_STEP = 4;
// Matches the fade width: a mouse resting this close to a faded edge
// steps the row that way, one stage per beat.
const EDGE_PX = 40;
const STEP_MS = 600;

/** Hover-scroll directions: back towards the first stage, none, on towards the last. */
const BACKWARD = -1;
const NO_DIRECTION = 0;
const FORWARD = 1;
/** `window.setInterval` never returns 0, so it marks "no timer running". */
const NO_TIMER = 0;
/** `PointerEvent.buttons` with no button held. */
const NO_BUTTONS = 0;
/** What `indexOf` returns for a missing slide. */
const NOT_FOUND = -1;

interface Edges {
	readonly prev: boolean;
	readonly next: boolean;
}

interface HoverState {
	dir: number;
	timer: number;
}

const NO_EDGES: Edges = { prev: false, next: false };

type EmblaApi = NonNullable<CarouselApi>;
type CarouselOptions = NonNullable<React.ComponentProps<typeof Carousel>["opts"]>;

function reducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Embla follows focus only after a Tab press, but the stepper moves focus
// with the arrow keys, so the browser would scroll the clipped viewport
// natively. Undo that and bring the stage in through Embla instead.
function followFocus(api: EmblaApi, event: FocusEvent): boolean {
	const root = api.rootNode();
	root.scrollLeft = 0;
	const slide = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-slot=carousel-item]") : null;
	if (slide === null) return false;
	const index = api.slideNodes().indexOf(slide);
	if (index === NOT_FOUND) return false;
	const box = root.getBoundingClientRect();
	const { left, right } = slide.getBoundingClientRect();
	if (left < box.left || right > box.right) {
		api.scrollTo(Math.min(index, api.scrollSnapList().length - STEP_INCREMENT), reducedMotion());
	}
	return false;
}

const carouselOptions: CarouselOptions = {
	align: "start",
	dragFree: true,
	inViewThreshold: 1,
	startIndex: START_STEP - STEP_INCREMENT,
	watchFocus: followFocus,
};

function sameEdges(previous: Edges, next: Edges): boolean {
	return previous.prev === next.prev && previous.next === next.next;
}

export function Stepper18Example(): React.JSX.Element {
	const [current, setCurrent] = useState<number>(START_STEP);
	const [api, setApi] = useState<CarouselApi>();
	const [edges, setEdges] = useState<Edges>(NO_EDGES);
	const prevRef = useRef<HTMLButtonElement>(null);
	const nextRef = useRef<HTMLButtonElement>(null);
	// One past the last step marks every step complete. No tab is selected
	// then, so the last one keeps the tablist's tab stop.
	const allDone = current > stages.length;
	const hover = useRef<HoverState>({ dir: NO_DIRECTION, timer: NO_TIMER });

	// Each faded edge shows only while there is more row past it, so a
	// row that fits renders as a plain stepper: no fade, nothing to drag.
	useEffect((): (() => void) | undefined => {
		if (api === undefined) return undefined;
		const sync = (): void => {
			const next: Edges = { prev: api.canScrollPrev(), next: api.canScrollNext() };
			setEdges((previous: Edges): Edges => (sameEdges(previous, next) ? previous : next));
		};
		sync();
		api.on("scroll", sync).on("reInit", sync);
		return (): void => {
			api.off("scroll", sync).off("reInit", sync);
		};
	}, [api]);

	// Previous and Next live outside the row, so bring the active stage in
	// when it is not fully visible. Snaps are trimmed at the end, so a late
	// stage shares the last snap.
	useEffect((): void => {
		if (api === undefined || api.slidesInView().includes(current - STEP_INCREMENT)) return;
		const snap = Math.min(current - STEP_INCREMENT, api.scrollSnapList().length - STEP_INCREMENT);
		api.scrollTo(snap, reducedMotion());
	}, [api, current]);

	useEffect(
		(): (() => void) => (): void => {
			window.clearInterval(hover.current.timer);
		},
		[],
	);

	const hoverEdge = useCallback(
		(dir: number): void => {
			if (api === undefined || dir === hover.current.dir) return;
			window.clearInterval(hover.current.timer);
			hover.current = { dir, timer: NO_TIMER };
			if (dir === NO_DIRECTION) return;
			const stepRow = (): void => {
				if (dir === BACKWARD ? !api.canScrollPrev() : !api.canScrollNext()) {
					window.clearInterval(hover.current.timer);
					hover.current = { dir: NO_DIRECTION, timer: NO_TIMER };
					return;
				}
				if (dir === BACKWARD) api.scrollPrev(reducedMotion());
				else api.scrollNext(reducedMotion());
			};
			stepRow();
			hover.current.timer = window.setInterval(stepRow, STEP_MS);
		},
		[api],
	);

	const onPointerMove = useCallback(
		(event: React.PointerEvent<HTMLDivElement>): void => {
			if (event.pointerType !== "mouse" || event.buttons !== NO_BUTTONS) {
				hoverEdge(NO_DIRECTION);
				return;
			}
			const { left, right } = event.currentTarget.getBoundingClientRect();
			if (event.clientX < left + EDGE_PX && edges.prev) hoverEdge(BACKWARD);
			else if (event.clientX > right - EDGE_PX && edges.next) hoverEdge(FORWARD);
			else hoverEdge(NO_DIRECTION);
		},
		[edges, hoverEdge],
	);

	const onPointerLeave = useCallback((): void => {
		hoverEdge(NO_DIRECTION);
	}, [hoverEdge]);

	const goTo = useCallback((step: number): void => {
		setCurrent(step);
		// The pressed button disables itself at either end, so focus moves
		// to its partner.
		if (step === FIRST_STEP) nextRef.current?.focus();
		if (step > stages.length) prevRef.current?.focus();
	}, []);

	const goToPreviousStep = useCallback((): void => {
		goTo(current - STEP_INCREMENT);
	}, [current, goTo]);

	const goToNextStep = useCallback((): void => {
		goTo(current + STEP_INCREMENT);
	}, [current, goTo]);

	return (
		<Stepper value={current} onValueChange={setCurrent} indicators={indicators} className="flex max-w-3xl flex-col gap-6" aria-label="Shipment timeline">
			<StepperNav>
				{/* The stepper owns the tablist roles and the arrow keys, so the
            carousel's own region role and key handler are switched off; it
            only moves the row. Slides grow to fill a wide box and keep their
            content width in a narrow one, which is when the row scrolls. */}
				<Carousel
					setApi={setApi}
					opts={carouselOptions}
					role={undefined}
					aria-roledescription={undefined}
					onKeyDownCapture={undefined}
					onPointerMove={onPointerMove}
					onPointerLeave={onPointerLeave}
					data-prev={edges.prev || undefined}
					data-next={edges.next || undefined}
					className="-m-1 min-w-0 flex-1 data-next:mask-r-from-[calc(100%-2.5rem)] data-prev:mask-l-from-[calc(100%-2.5rem)]">
					<CarouselContent className="ml-0 py-1">
						{stages.map((stage, index) => {
							const step = index + 1;
							const last = step === stages.length;

							// The primitive shows loading on the active stage only, so every
							// stage carries the flag, the spinner follows the selection and
							// `indicators` needs no `active` entry.
							return (
								<CarouselItem key={stage.title} role={undefined} aria-roledescription={undefined} className={cn("basis-auto pl-1", last ? "min-w-32 pr-1" : "grow")}>
									<StepperItem step={step} loading className="items-stretch justify-start gap-2 group-data-[orientation=horizontal]/stepper-nav:flex-col">
										<div className="flex items-center gap-1">
											<StepperTrigger tabIndex={allDone && step === stages.length ? TAB_STOP : undefined} aria-label={stage.title}>
												<StepperIndicator className="size-6.5 border border-ring/80 bg-transparent data-[state=active]:bg-transparent data-[state=completed]:border-success data-[state=completed]:bg-transparent" />
											</StepperTrigger>

											{/* data-state greens the start once this stage is done;
                          the end follows only when the next stage is done too.
                          The last connector fades out: the route continues past
                          the part this timeline shows. */}
											{step < stages.length ? (
												<StepperSeparator
													className={cn(
														dots,
														"from-ring/80 to-ring/80 to-70% data-[state=completed]:from-success",
														step + 1 < current ? "to-success" : "data-[state=completed]:to-ring",
													)}
												/>
											) : (
												<StepperSeparator className={cn(dots, "from-ring/80 to-transparent")} />
											)}
										</div>

										{/* The title and the detail labels share one auto column
                        through subgrid, so every leader in a stage starts at the
                        same x and the column follows the font, not a fixed width. */}
										<div className={cn("grid grid-cols-[auto_1fr] items-baseline gap-x-1 gap-y-1.5 ps-0.5", last ? "pe-1" : "pe-5")}>
											<StepperTitle>{stage.title}</StepperTitle>
											<div className="flex items-baseline gap-1">
												<Leader />
												<span className="text-xs whitespace-nowrap text-muted-foreground">{stage.time}</span>
											</div>

											<dl className="col-span-2 grid grid-cols-subgrid gap-y-1.5">
												{stage.details.map((detail: Detail): React.JSX.Element => (
													<div key={detail.label} className="col-span-2 grid grid-cols-subgrid items-baseline">
														<dt className="text-xs font-medium">{detail.label}</dt>
														<dd className="flex items-baseline gap-1">
															<Leader />
															{detail.initials !== undefined ? (
																// Only the name takes part in baseline alignment (the avatar
																// centers itself), so the badge's baseline is its text and the
																// row lines up with its neighbours.
																<Badge variant="outline" radius="full" className="items-baseline">
																	<Avatar className="size-3.5 self-center">
																		<AvatarFallback>{detail.initials}</AvatarFallback>
																	</Avatar>
																	{detail.value}
																</Badge>
															) : detail.badge !== undefined ? (
																<Badge variant={detail.badge} radius="full">
																	{detail.value}
																</Badge>
															) : (
																<span className="text-xs whitespace-nowrap text-muted-foreground">{detail.value}</span>
															)}
														</dd>
													</div>
												))}
											</dl>
										</div>
									</StepperItem>
								</CarouselItem>
							);
						})}
					</CarouselContent>
				</Carousel>
			</StepperNav>

			<StepperPanel className="text-center">
				{stages.map((stage, index) => (
					<StepperContent key={stage.title} value={index + 1}>
						<p className="text-sm font-medium">{stage.title}</p>
						<p className="text-sm text-muted-foreground">{stage.summary}</p>
					</StepperContent>
				))}
				<StepperContent value={stages.length + 1}>
					<p className="text-sm font-medium">Run complete</p>
					<p className="text-sm text-muted-foreground">Back at depot B23 with every stop delivered.</p>
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
