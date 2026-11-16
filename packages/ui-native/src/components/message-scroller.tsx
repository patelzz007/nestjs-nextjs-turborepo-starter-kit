// The web kit's `MessageScroller` for a phone: a chat transcript that opens where it should (the newest message, the
// start, or the last anchored turn at the top), follows a streaming reply while the reader is at the end, lifts a
// just-sent turn to the top under a peek of the one before, and keeps the reader's place when older messages load
// above. The same parts as the web: a provider with the options, the root, the scrolling viewport, the content, one
// item per message (`messageId`, `scrollAnchor`), and jump buttons; and the same hooks: `useMessageScroller` (scroll
// to the end, the start or a message), `useMessageScrollerScrollable` and `useMessageScrollerVisibility`.
//
// Two contexts: the actions (stable) for the items and buttons, the scroll state (changes as the reader scrolls) for
// the hooks, so scrolling re-renders only what reads where the reader is.

import { cva } from "class-variance-authority";
import ArrowDownIcon from "lucide-react-native/icons/arrow-down";
import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import * as React from "react";
import { ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import {
	anchorOffset,
	anchorSpacer,
	DEFAULT_PREVIOUS_ITEM_PEEK,
	DEFAULT_SCROLL_EDGE_THRESHOLD,
	isNearEnd,
	maxScrollOffset,
	openingOffset,
	readingPosition,
	readingShift,
	scrollableFrom,
	visibilityOf,
	type MessageLayout,
	type MessageScrollerDefaultScrollPosition,
	type MessageScrollerScrollable,
	type MessageScrollerVisibility,
	type ReadingPosition,
	type ScrollMetrics,
} from "../lib/message-scroller";
import { IconButton } from "./icon-button";

/** Where `scrollToMessage` puts a message: at the top (under the peek), the middle or the bottom of the view. */
export type MessageScrollerScrollAlign = "start" | "center" | "end";

export interface MessageScrollerScrollOptions {
	readonly animated?: boolean | undefined;
	readonly align?: MessageScrollerScrollAlign | undefined;
}

interface ScrollerOptions {
	readonly autoScroll: boolean;
	readonly defaultScrollPosition: MessageScrollerDefaultScrollPosition;
	readonly scrollEdgeThreshold: number;
	readonly scrollPreviousItemPeek: number;
	readonly preserveScrollOnPrepend: boolean;
}

interface Actions {
	readonly options: ScrollerOptions;
	readonly register: (layout: MessageLayout) => void;
	readonly unregister: (id: string) => void;
	readonly scrollToEnd: (options?: MessageScrollerScrollOptions) => boolean;
	readonly scrollToStart: (options?: MessageScrollerScrollOptions) => boolean;
	readonly scrollToMessage: (id: string, options?: MessageScrollerScrollOptions) => boolean;
	readonly viewport: {
		/** Hands the scroll view to the provider (a callback ref). */
		readonly attach: (view: ScrollViewInstance | null) => void;
		readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
		readonly onLayout: (event: LayoutChangeEvent) => void;
		readonly onContentSizeChange: (width: number, height: number) => void;
	};
}

interface ScrollState {
	readonly metrics: ScrollMetrics;
	readonly layouts: readonly MessageLayout[];
}

const ActionsContext = React.createContext<Actions | null>(null);
const StateContext = React.createContext<ScrollState | null>(null);

function useActions(): Actions {
	const actions = React.useContext(ActionsContext);
	if (actions === null) {
		throw new Error("MessageScroller parts must sit inside <MessageScrollerProvider>.");
	}
	return actions;
}

function useScrollState(): ScrollState {
	const state = React.useContext(StateContext);
	if (state === null) {
		throw new Error("MessageScroller hooks must be used inside <MessageScrollerProvider>.");
	}
	return state;
}

/** Scroll the transcript: to its end, its start, or one message. Each returns whether there was a view to scroll. */
export function useMessageScroller(): Pick<Actions, "scrollToEnd" | "scrollToStart" | "scrollToMessage"> {
	const { scrollToEnd, scrollToStart, scrollToMessage } = useActions();
	return React.useMemo(() => ({ scrollToEnd, scrollToStart, scrollToMessage }), [scrollToEnd, scrollToMessage, scrollToStart]);
}

/** Whether the transcript can scroll towards its start and its end. */
export function useMessageScrollerScrollable(): MessageScrollerScrollable {
	const { metrics } = useScrollState();
	const { options } = useActions();
	return scrollableFrom(metrics, options.scrollEdgeThreshold);
}

/** The messages on screen, and the anchored turn the reader is in. */
export function useMessageScrollerVisibility(): MessageScrollerVisibility {
	const { metrics, layouts } = useScrollState();
	const { options } = useActions();
	return visibilityOf(layouts, metrics, options.scrollPreviousItemPeek);
}

export interface MessageScrollerProviderProps {
	readonly children?: React.ReactNode;
	/** Follow new content while the reader is at the end. Default `true`. */
	readonly autoScroll?: boolean | undefined;
	readonly defaultScrollPosition?: MessageScrollerDefaultScrollPosition | undefined;
	/** How close to an edge counts as at it, in points. */
	readonly scrollEdgeThreshold?: number | undefined;
	/** How much of the turn before an anchored turn stays in view above it, in points. */
	readonly scrollPreviousItemPeek?: number | undefined;
	/** Keep the reader's place when older messages are added above. Default `true`. */
	readonly preserveScrollOnPrepend?: boolean | undefined;
	/** Extra classes for the provider's view (`flex-1` to fill a screen), merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const messageScrollerProviderVariants = cva("min-h-0");

export const messageScrollerVariants = cva("relative min-h-0 flex-1 overflow-hidden");

export const messageScrollerViewportVariants = cva("min-h-0 flex-1");

export const messageScrollerContentVariants = cva("gap-8");

export const messageScrollerButtonVariants = cva("absolute inset-x-0 items-center", {
	variants: { direction: { end: "bottom-4", start: "top-4" } },
	defaultVariants: { direction: "end" },
});

const EMPTY_METRICS: ScrollMetrics = { offset: 0, viewport: 0, content: 0 };

function byTop(first: MessageLayout, second: MessageLayout): number {
	return first.y - second.y;
}

/** Holds one transcript's scroll state and behaviour for the parts inside it. */
export const MessageScrollerProvider = React.memo(
	React.forwardRef<ViewInstance, MessageScrollerProviderProps>(function MessageScrollerProvider(
		{
			children,
			autoScroll = true,
			defaultScrollPosition = "end",
			scrollEdgeThreshold = DEFAULT_SCROLL_EDGE_THRESHOLD,
			scrollPreviousItemPeek = DEFAULT_PREVIOUS_ITEM_PEEK,
			preserveScrollOnPrepend = true,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const scrollRef = React.useRef<ScrollViewInstance | null>(null);
		const [metrics, setMetrics] = React.useState<ScrollMetrics>(EMPTY_METRICS);
		const [layoutMap, setLayoutMap] = React.useState<ReadonlyMap<string, MessageLayout>>(new Map());
		const layouts = React.useMemo((): readonly MessageLayout[] => [...layoutMap.values()].sort(byTop), [layoutMap]);
		/**
		 * What the effect compares against: the last layouts it saw, the reader's offset (from scroll events and the
		 * provider's own scrolls), the anchored turns already lifted, and whether the transcript has opened.
		 */
		const seen = React.useRef<{
			layouts: readonly MessageLayout[];
			offset: number;
			content: number;
			reading: ReadingPosition | null;
			anchors: ReadonlySet<string>;
			opened: boolean;
		}>({
			layouts: [],
			offset: 0,
			content: 0,
			reading: null,
			anchors: new Set(),
			opened: false,
		});
		const options = React.useMemo(
			(): ScrollerOptions => ({ autoScroll, defaultScrollPosition, scrollEdgeThreshold, scrollPreviousItemPeek, preserveScrollOnPrepend }),
			[autoScroll, defaultScrollPosition, preserveScrollOnPrepend, scrollEdgeThreshold, scrollPreviousItemPeek],
		);

		const scrollTo = React.useCallback((offset: number, animated: boolean): boolean => {
			const view = scrollRef.current;
			if (view === null) {
				return false;
			}
			view.scrollTo({ y: offset, animated });
			seen.current.offset = offset;
			return true;
		}, []);

		// Each change of layout or size: open where asked; lift a newly sent anchored turn to the top; keep the reader's
		// place when what they are reading moves (older messages arriving above); and follow growth at the end.
		React.useEffect((): void => {
			const before = seen.current;
			const was = { offset: before.offset, viewport: metrics.viewport, content: before.content };
			const anchors = new Set(layouts.filter((layout): boolean => layout.anchor).map((layout): string => layout.id));
			if (metrics.viewport > 0 && layouts.length > 0) {
				// Which message the reader is on changes only when someone scrolls: they do (onScroll), or this does.
				let scrolled = false;
				if (!before.opened) {
					before.opened = scrollTo(openingOffset(defaultScrollPosition, layouts, metrics, scrollPreviousItemPeek), false);
					scrolled = before.opened;
				} else {
					const fresh = layouts.filter((layout): boolean => layout.anchor && !before.anchors.has(layout.id)).at(-1);
					const shift = preserveScrollOnPrepend ? readingShift(before.reading, layouts) : 0;
					if (fresh !== undefined) {
						scrolled = scrollTo(anchorOffset(fresh, metrics, scrollPreviousItemPeek), true);
					} else if (shift !== 0 && before.reading !== null) {
						scrollTo(was.offset + shift, false);
						before.reading = { id: before.reading.id, y: before.reading.y + shift };
					} else if (autoScroll && isNearEnd(was, scrollEdgeThreshold) && metrics.content > was.content) {
						scrolled = scrollTo(maxScrollOffset(metrics), false);
					}
				}
				before.anchors = anchors;
				if (scrolled || before.reading === null) {
					before.reading = readingPosition(layouts, { ...metrics, offset: before.offset });
				}
			}
			before.layouts = layouts;
			before.content = metrics.content;
		}, [autoScroll, defaultScrollPosition, layouts, metrics, preserveScrollOnPrepend, scrollEdgeThreshold, scrollPreviousItemPeek, scrollTo]);

		const register = React.useCallback((layout: MessageLayout): void => {
			setLayoutMap((current) => {
				const was = current.get(layout.id);
				if (was !== undefined && was.y === layout.y && was.height === layout.height && was.anchor === layout.anchor) {
					return current;
				}
				return new Map(current).set(layout.id, layout);
			});
		}, []);
		const unregister = React.useCallback((id: string): void => {
			setLayoutMap((current) => {
				if (!current.has(id)) {
					return current;
				}
				const next = new Map(current);
				next.delete(id);
				return next;
			});
		}, []);

		const scrollToEnd = React.useCallback((scroll: MessageScrollerScrollOptions = {}): boolean => scrollTo(Number.MAX_SAFE_INTEGER, scroll.animated ?? true), [scrollTo]);
		const scrollToStart = React.useCallback((scroll: MessageScrollerScrollOptions = {}): boolean => scrollTo(0, scroll.animated ?? true), [scrollTo]);
		const scrollToMessage = React.useCallback(
			(id: string, scroll: MessageScrollerScrollOptions = {}): boolean => {
				const message = layoutMap.get(id);
				if (message === undefined) {
					return false;
				}
				const align = scroll.align ?? "start";
				const half = 2;
				const offset =
					align === "start"
						? anchorOffset(message, metrics, scrollPreviousItemPeek)
						: align === "center"
							? message.y + message.height / half - metrics.viewport / half
							: message.y + message.height - metrics.viewport;
				return scrollTo(Math.min(maxScrollOffset(metrics), Math.max(0, offset)), scroll.animated ?? true);
			},
			[layoutMap, metrics, scrollPreviousItemPeek, scrollTo],
		);

		const onScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
			const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
			seen.current.offset = contentOffset.y;
			seen.current.reading = readingPosition(seen.current.layouts, { offset: contentOffset.y, viewport: layoutMeasurement.height, content: contentSize.height });
			setMetrics({ offset: contentOffset.y, viewport: layoutMeasurement.height, content: contentSize.height });
		}, []);
		const onLayout = React.useCallback((event: LayoutChangeEvent): void => {
			const { height } = event.nativeEvent.layout;
			setMetrics((current) => (current.viewport === height ? current : { ...current, viewport: height }));
		}, []);
		const onContentSizeChange = React.useCallback((_width: number, height: number): void => {
			setMetrics((current) => (current.content === height ? current : { ...current, content: height }));
		}, []);

		const attach = React.useCallback((view: ScrollViewInstance | null): void => {
			scrollRef.current = view;
		}, []);
		const actions = React.useMemo(
			(): Actions => ({
				options,
				register,
				unregister,
				scrollToEnd,
				scrollToStart,
				scrollToMessage,
				viewport: { attach, onScroll, onLayout, onContentSizeChange },
			}),
			[attach, onContentSizeChange, onLayout, onScroll, options, register, scrollToEnd, scrollToMessage, scrollToStart, unregister],
		);
		const state = React.useMemo((): ScrollState => ({ metrics, layouts }), [layouts, metrics]);
		return (
			<ActionsContext.Provider value={actions}>
				<StateContext.Provider value={state}>
					<View ref={ref} testID={testID} className={cn(messageScrollerProviderVariants(), className)}>
						{children}
					</View>
				</StateContext.Provider>
			</ActionsContext.Provider>
		);
	}),
);

interface PartProps {
	readonly children?: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The transcript's frame: fills its parent; the jump buttons sit over it. */
export const MessageScroller = React.memo(
	React.forwardRef<ViewInstance, PartProps>(function MessageScroller({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(messageScrollerVariants(), className)} testID={testID}>
				{children}
			</View>
		);
	}),
);

export interface MessageScrollerViewportProps extends PartProps {
	readonly accessibilityLabel?: string | undefined;
}

/** The scrolling region (`className` styles the scroll view). Name it (`accessibilityLabel`) for a screen reader: "Conversation". */
export const MessageScrollerViewport = React.memo(
	React.forwardRef<ViewInstance, MessageScrollerViewportProps>(function MessageScrollerViewport({ children, className, testID, accessibilityLabel }, ref): React.JSX.Element {
		const {
			viewport: { attach, onScroll, onLayout, onContentSizeChange },
		} = useActions();
		return (
			<View ref={ref} className={messageScrollerViewportVariants()}>
				<ScrollView
					ref={attach}
					onScroll={onScroll}
					onLayout={onLayout}
					onContentSizeChange={onContentSizeChange}
					scrollEventThrottle={16}
					accessibilityLabel={accessibilityLabel}
					className={cn("flex-1", className)}
					testID={testID}>
					{children}
				</ScrollView>
			</View>
		);
	}),
);

/** The messages, with the room an anchored turn needs below it to reach the top. New messages are announced. */
export const MessageScrollerContent = React.memo(
	React.forwardRef<ViewInstance, PartProps>(function MessageScrollerContent({ children, className, testID }, ref): React.JSX.Element {
		const { layouts, metrics } = useScrollState();
		const { options } = useActions();
		const spacer = anchorSpacer(layouts, metrics.viewport, options.scrollPreviousItemPeek);
		const spacerStyle = React.useMemo(() => ({ height: spacer }), [spacer]);
		return (
			<View ref={ref} accessibilityLiveRegion="polite" className={cn(messageScrollerContentVariants(), className)} testID={testID}>
				{children}
				{spacer === 0 ? null : <View style={spacerStyle} />}
			</View>
		);
	}),
);

export interface MessageScrollerItemProps extends PartProps {
	readonly messageId: string;
	/** A turn the reader lands on: lifted to the top (under a peek of the one before) when it arrives. */
	readonly scrollAnchor?: boolean | undefined;
}

/** One message or turn. */
export const MessageScrollerItem = React.memo(
	React.forwardRef<ViewInstance, MessageScrollerItemProps>(function MessageScrollerItem(
		{ messageId, scrollAnchor = false, children, className, testID },
		ref,
	): React.JSX.Element {
		const { register, unregister } = useActions();
		const measure = React.useCallback(
			(event: LayoutChangeEvent): void => {
				const { y, height } = event.nativeEvent.layout;
				register({ id: messageId, y, height, anchor: scrollAnchor });
			},
			[messageId, register, scrollAnchor],
		);
		React.useEffect(
			(): (() => void) => (): void => {
				unregister(messageId);
			},
			[messageId, unregister],
		);
		return (
			<View ref={ref} onLayout={measure} className={cn("min-w-0", className)} testID={testID}>
				{children}
			</View>
		);
	}),
);

export interface MessageScrollerButtonProps {
	/** Its accessible name ("Scroll to latest message"): the caller's words. */
	readonly label: string;
	/** `end` (the default) jumps to the newest message; `start` to the first. */
	readonly direction?: "start" | "end" | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A jump to the end (or the start), shown while the reader is away from it. Keep it beside the viewport. */
export const MessageScrollerButton = React.memo(
	React.forwardRef<ViewInstance, MessageScrollerButtonProps>(function MessageScrollerButton({ label, direction = "end", className, testID }, ref): React.JSX.Element | null {
		const scrollable = useMessageScrollerScrollable();
		const { scrollToEnd, scrollToStart } = useActions();
		const jump = React.useCallback((): void => {
			if (direction === "end") {
				scrollToEnd();
			} else {
				scrollToStart();
			}
		}, [direction, scrollToEnd, scrollToStart]);
		if (!scrollable[direction]) {
			return null;
		}
		return (
			<View ref={ref} pointerEvents="box-none" className={cn(messageScrollerButtonVariants({ direction }), className)}>
				<IconButton icon={direction === "end" ? ArrowDownIcon : ArrowUpIcon} label={label} onPress={jump} variant="secondary" size="sm" testID={testID} />
			</View>
		);
	}),
);
