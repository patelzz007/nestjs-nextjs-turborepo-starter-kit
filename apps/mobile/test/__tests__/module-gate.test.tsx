import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { createModuleGate } from "../module-gate";

function Content({ label }: { readonly label: string }): React.JSX.Element {
	return <Text className="font-sans">{label}</Text>;
}

describe("createModuleGate", () => {
	it("counts each evaluation and passes the module's exports through unchanged", () => {
		const gate = createModuleGate();
		const module = { Content };

		expect(gate.evaluations()).toBe(0);
		expect(gate.evaluated(module)).toBe(module);
		expect(gate.evaluations()).toBe(1);
	});

	it("holds a gated view behind its Suspense fallback until the gate opens", async () => {
		const gate = createModuleGate();
		const Gated = gate.gated(Content);

		await render(
			<React.Suspense fallback={<Text className="font-sans">Loading</Text>}>
				<Gated label="Ready" />
			</React.Suspense>,
		);
		expect(screen.getByText("Loading")).toBeOnTheScreen();
		expect(screen.queryByText("Ready")).toBeNull();

		await gate.open();
		expect(screen.getByText("Ready")).toBeOnTheScreen();
		expect(screen.queryByText("Loading")).toBeNull();
	});
});
