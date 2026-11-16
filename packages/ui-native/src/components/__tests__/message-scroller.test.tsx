import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { ScrollView, Text } from "react-native";

import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
	useMessageScroller,
	useMessageScrollerScrollable,
	useMessageScrollerVisibility,
	type MessageScrollerProviderProps,
} from "../message-scroller";

interface Turn {
	readonly id: string;
	readonly text: string;
	readonly anchor?: boolean;
}

const TURNS: readonly Turn[] = [
	{ id: "q1", text: "First question", anchor: true },
	{ id: "a1", text: "First answer" },
	{ id: "q2", text: "Second question", anchor: true },
	{ id: "a2", text: "Second answer" },
];

/** The heights the tests lay each turn out at (100 each, 32 apart: the content's gap-8). */
const HEIGHT = 100;
const GAP = 32;

let scrollTo: jest.Mock;
let restore: (() => void) | null = null;

/** Spies on every ScrollView's `scrollTo` (the method lives on the mock instance's prototype). */
async function spyOnScrollTo(): Promise<void> {
	const ref = React.createRef<React.ComponentRef<typeof ScrollView>>();
	const probe = await render(<ScrollView ref={ref} />);
	const prototype = ref.current === null ? null : Reflect.getPrototypeOf(ref.current);
	await probe.unmount();
	if (prototype === null) {
		throw new Error("The ScrollView mock has an instance.");
	}
	const original = Reflect.getOwnPropertyDescriptor(prototype, "scrollTo");
	scrollTo = jest.fn();
	Reflect.defineProperty(prototype, "scrollTo", { value: scrollTo, configurable: true, writable: true });
	restore = (): void => {
		if (original === undefined) {
			Reflect.deleteProperty(prototype, "scrollTo");
		} else {
			Reflect.defineProperty(prototype, "scrollTo", original);
		}
	};
}

function Readout(): React.JSX.Element {
	const scrollable = useMessageScrollerScrollable();
	const visibility = useMessageScrollerVisibility();
	const { scrollToMessage, scrollToStart } = useMessageScroller();
	const toFirst = React.useCallback((): void => {
		scrollToMessage("q1", { align: "center" });
		scrollToMessage("a2", { align: "end", animated: false });
		scrollToMessage("missing");
		scrollToStart();
	}, [scrollToMessage, scrollToStart]);
	return (
		<Text
			onPress={toFirst}
			testID="readout">{`${String(scrollable.start)} ${String(scrollable.end)} ${visibility.currentAnchorId ?? "none"} ${visibility.visibleMessageIds.join(",")}`}</Text>
	);
}

function Transcript({ turns = TURNS, ...props }: MessageScrollerProviderProps & { readonly turns?: readonly Turn[] }): React.JSX.Element {
	return (
		<MessageScrollerProvider {...props}>
			<MessageScroller testID="scroller">
				<MessageScrollerViewport testID="viewport" accessibilityLabel="Conversation">
					<MessageScrollerContent testID="content">
						{turns.map((turn: Turn): React.JSX.Element => (
							<MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor={turn.anchor === true} testID={turn.id}>
								<Text>{turn.text}</Text>
							</MessageScrollerItem>
						))}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton label="Scroll to latest message" />
				<MessageScrollerButton label="Scroll to first message" direction="start" />
			</MessageScroller>
			<Readout />
		</MessageScrollerProvider>
	);
}

/** Lays the viewport and each turn out, as the native layout pass would. */
async function layOut(turns: readonly Turn[], viewport = 300): Promise<void> {
	for (const [index, turn] of turns.entries()) {
		await fireEvent(screen.getByTestId(turn.id), "layout", { nativeEvent: { layout: { x: 0, y: index * (HEIGHT + GAP), width: 320, height: HEIGHT } } });
	}
	await fireEvent(screen.getByTestId("viewport"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: viewport } } });
	await fireEvent(screen.getByTestId("viewport"), "contentSizeChange", 320, turns.length * (HEIGHT + GAP) - GAP);
}

async function scrollReader(offset: number, content: number, viewport = 300): Promise<void> {
	await fireEvent.scroll(screen.getByTestId("viewport"), {
		nativeEvent: { contentOffset: { x: 0, y: offset }, layoutMeasurement: { width: 320, height: viewport }, contentSize: { width: 320, height: content } },
	});
}

beforeAll(async (): Promise<void> => {
	await spyOnScrollTo();
});

beforeEach((): void => {
	scrollTo.mockClear();
});

afterAll((): void => {
	restore?.();
	restore = null;
});

describe("MessageScroller", () => {
	it("opens at the newest message, and offers a jump back once the reader scrolls up", async () => {
		await render(<Transcript />);
		await layOut(TURNS);
		expect(scrollTo).toHaveBeenCalledWith({ y: 196, animated: false });

		await scrollReader(0, 496);
		expect(screen.getByTestId("readout")).toHaveTextContent("false true q1 q1,a1,q2");
		await fireEvent.press(screen.getByRole("button", { name: "Scroll to latest message" }));
		expect(scrollTo).toHaveBeenLastCalledWith({ y: Number.MAX_SAFE_INTEGER, animated: true });

		await scrollReader(196, 496);
		expect(screen.queryByRole("button", { name: "Scroll to latest message" })).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Scroll to first message" }));
		expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });
	});

	it("opens at the start or with the last anchored turn at the top", async () => {
		const { rerender } = await render(<Transcript key="start" defaultScrollPosition="start" />);
		await layOut(TURNS);
		expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });

		await rerender(<Transcript key="anchor" defaultScrollPosition="last-anchor" scrollPreviousItemPeek={40} />);
		await layOut(TURNS);
		expect(scrollTo).toHaveBeenLastCalledWith({ y: 196, animated: false });
	});

	it("follows a growing reply at the end, but not once the reader has scrolled up", async () => {
		await render(<Transcript />);
		await layOut(TURNS);
		await scrollReader(196, 496);
		scrollTo.mockClear();
		await fireEvent(screen.getByTestId("viewport"), "contentSizeChange", 320, 560);
		expect(scrollTo).toHaveBeenLastCalledWith({ y: 260, animated: false });

		await scrollReader(0, 560);
		scrollTo.mockClear();
		await fireEvent(screen.getByTestId("viewport"), "contentSizeChange", 320, 600);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it("lifts a newly sent question to the top, with room below it", async () => {
		const { rerender } = await render(<Transcript />);
		await layOut(TURNS);
		scrollTo.mockClear();
		const sent = [...TURNS, { id: "q3", text: "Third question", anchor: true }];
		await rerender(<Transcript turns={sent} />);
		await layOut(sent);
		expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ animated: true }));
		expect(screen.getByTestId("content").children.length).toBe(sent.length + 1);
	});

	it("keeps the reader's place when older messages load above", async () => {
		const { rerender } = await render(<Transcript />);
		await layOut(TURNS);
		await scrollReader(132, 496);
		scrollTo.mockClear();
		const older = [{ id: "q0", text: "Earlier question", anchor: false }, ...TURNS];
		await rerender(<Transcript turns={older} />);
		await layOut(older);
		expect(scrollTo).toHaveBeenCalledWith({ y: 132 + HEIGHT + GAP, animated: false });
	});

	it("does not follow or keep its place when told not to, and scrolls to a message by alignment", async () => {
		const { rerender } = await render(<Transcript autoScroll={false} preserveScrollOnPrepend={false} />);
		await layOut(TURNS);
		await scrollReader(196, 496);
		scrollTo.mockClear();
		await fireEvent(screen.getByTestId("viewport"), "contentSizeChange", 320, 560);
		expect(scrollTo).not.toHaveBeenCalled();
		const older = [{ id: "q0", text: "Earlier question" }, ...TURNS];
		await rerender(<Transcript turns={older} autoScroll={false} preserveScrollOnPrepend={false} />);
		await layOut(older);
		expect(scrollTo).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByTestId("readout"));
		expect(scrollTo).toHaveBeenCalledTimes(3);
	});

	it("forgets a removed message, and refuses parts or hooks outside a provider", async () => {
		const { rerender } = await render(<Transcript />);
		await layOut(TURNS);
		await rerender(<Transcript turns={TURNS.slice(0, 2)} />);
		await act(async (): Promise<void> => {
			await scrollReader(0, 232);
		});
		expect(screen.getByTestId("readout")).toHaveTextContent("false false q1 q1,a1");

		jest.spyOn(console, "error").mockImplementation((): undefined => undefined);
		await expect(render(<MessageScrollerItem messageId="x" />)).rejects.toThrow("MessageScroller parts must sit inside <MessageScrollerProvider>.");
		await expect(render(<Readout />)).rejects.toThrow("MessageScroller hooks must be used inside <MessageScrollerProvider>.");
	});
});
