import { act, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { lazyView } from "../lazy-view";

interface GreetingProps {
	readonly name: string;
}

function Greeting({ name }: GreetingProps): React.JSX.Element {
	return <Text className="font-sans">{`Hello, ${name}`}</Text>;
}

function GreetingSkeleton(): React.JSX.Element {
	return <Text className="font-sans">Loading the greeting</Text>;
}

/** A module load the test finishes by hand, so the time before it resolves can be seen. */
interface PendingLoad {
	readonly load: () => Promise<React.ComponentType<GreetingProps>>;
	readonly finish: () => Promise<void>;
	readonly calls: () => number;
}

function pendingLoad(): PendingLoad {
	const resolvers: ((view: React.ComponentType<GreetingProps>) => void)[] = [];
	const state = { calls: 0 };
	return {
		load: (): Promise<React.ComponentType<GreetingProps>> => {
			state.calls += 1;
			return new Promise<React.ComponentType<GreetingProps>>((resolve): void => {
				resolvers.push(resolve);
			});
		},
		finish: async (): Promise<void> => {
			await act(async (): Promise<void> => {
				for (const resolve of resolvers) {
					resolve(Greeting);
				}
				await Promise.resolve();
			});
		},
		calls: (): number => state.calls,
	};
}

describe("lazyView", () => {
	it("does not load the view until it is first drawn", () => {
		const pending = pendingLoad();
		lazyView(pending.load, GreetingSkeleton);

		expect(pending.calls()).toBe(0);
	});

	it("draws the skeleton while the view loads, then the view with its props", async () => {
		const pending = pendingLoad();
		const LazyGreeting = lazyView(pending.load, GreetingSkeleton);

		await render(<LazyGreeting name="Ana" />);
		expect(screen.getByText("Loading the greeting")).toBeOnTheScreen();
		expect(screen.queryByText("Hello, Ana")).toBeNull();

		await pending.finish();
		expect(screen.getByText("Hello, Ana")).toBeOnTheScreen();
		expect(screen.queryByText("Loading the greeting")).toBeNull();
	});

	it("loads the view once, and draws it at once on every later render", async () => {
		const pending = pendingLoad();
		const LazyGreeting = lazyView(pending.load, GreetingSkeleton);
		await render(<LazyGreeting name="Ana" />);
		await pending.finish();
		await screen.unmount();

		await render(<LazyGreeting name="Ben" />);
		expect(screen.getByText("Hello, Ben")).toBeOnTheScreen();
		expect(screen.queryByText("Loading the greeting")).toBeNull();
		expect(pending.calls()).toBe(1);
	});
});
