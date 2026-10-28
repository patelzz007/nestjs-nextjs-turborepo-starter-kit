// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PROVIDER_LABELS, ProviderIcon } from "../provider-icon";
import { SparkStatCard } from "../spark-stat-card";

afterEach(() => {
	cleanup();
});

function formatPercent(value: number): string {
	return `${value.toFixed(0)}%`;
}

describe("ProviderIcon", () => {
	it("draws each cloud's own logo, and plain icons for a laptop or another machine", () => {
		const { container } = render(
			<div>
				<ProviderIcon provider="DIGITALOCEAN" />
				<ProviderIcon provider="LINODE" />
				<ProviderIcon provider="VULTR" />
				<ProviderIcon provider="HETZNER" />
				<ProviderIcon provider="LOCAL" />
				<ProviderIcon provider="OTHER" />
			</div>,
		);
		const logos = container.querySelectorAll('svg[role="img"] path');

		expect(logos).toHaveLength(4);
		expect(container.querySelectorAll("svg")).toHaveLength(6);
		expect(PROVIDER_LABELS.LINODE).toBe("Linode");
	});
});

describe("SparkStatCard", () => {
	it("shows the figure, what it is made of, and how it moved — in words as well as the arrow", () => {
		render(
			<SparkStatCard
				title="Memory"
				value="64%"
				detail="41.3 GB of 64.0 GB"
				change={{ delta: 12, label: "12 pts higher than 24 hours ago", higherIsWorse: true }}
				points={[]}
				format={formatPercent}
			/>,
		);

		expect(screen.getByText("Memory")).toBeDefined();
		expect(screen.getByText("64%")).toBeDefined();
		expect(screen.getByText("41.3 GB of 64.0 GB")).toBeDefined();
		expect(screen.getByText("12 pts higher than 24 hours ago")).toBeDefined();
	});

	it("leaves the change line out when there is no history", () => {
		render(<SparkStatCard title="CPU" value="—" detail="Not reporting" change={null} points={[]} format={formatPercent} />);

		expect(screen.queryByText(/than .* ago/)).toBeNull();
	});
});
