// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { defineUrlState, optionalUrlParam } from "../url-state";
import { UrlStateProvider } from "../url-state-provider";
import { useUrlState } from "../use-url-state";

// Outside a Next.js app there is no router: these stand in for the App Router the
// provider adapts.
vi.mock("next/navigation", () => ({
	usePathname: (): string => "/rewards",
	useRouter: (): { readonly replace: () => void } => ({ replace: (): void => undefined }),
	useSearchParams: (): URLSearchParams => new URLSearchParams("status=drafts"),
}));

const STATUS_URL_STATE = defineUrlState({ status: optionalUrlParam(z.enum(["live", "drafts"])) });

afterEach((): void => {
	cleanup();
});

describe("UrlStateProvider", () => {
	it("gives useUrlState the App Router's search params", () => {
		const { result } = renderHook(() => useUrlState(STATUS_URL_STATE), { wrapper: UrlStateProvider });
		expect(result.current[LIST_SLOT_INDEX.first].status).toBe("drafts");
	});
});
