// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { RewardStatusSchema } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MerchantRewardStatusBadge } from "./reward-status";

afterEach((): void => {
	cleanup();
});

describe("MerchantRewardStatusBadge", () => {
	it("draws a reward in review as waiting, a live one as good news and a disabled one as blocked", () => {
		render(
			<>
				<MerchantRewardStatusBadge status="PENDING_REVIEW" />
				<MerchantRewardStatusBadge status="PUBLISHED" />
				<MerchantRewardStatusBadge status="DISABLED" />
			</>,
		);

		expect(screen.getByText("In review").dataset.tone).toBe("warning");
		expect(screen.getByText("Live").dataset.tone).toBe("success");
		expect(screen.getByText("Disabled").dataset.tone).toBe("danger");
	});

	it("labels every status in words, never the raw enum value", () => {
		for (const status of RewardStatusSchema.options) {
			cleanup();
			render(<MerchantRewardStatusBadge status={status} />);
			expect(screen.queryByText(status)).toBeNull();
		}
	});
});
