// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchableEntityPickerProps } from "@/components/common/searchable-entity-picker";

import { REFERRER_PICKER_RESULT_LIMIT, ReferrerPicker } from "../referrer-picker";

const REFERRER_ID = "8c1b6d2e-4f3a-4b5c-9d6e-7f8a9b0c1d2e";

const { listQuery, detailQuery, renderedPicker } = vi.hoisted(() => ({
	listQuery: vi.fn(),
	detailQuery: vi.fn(),
	renderedPicker: vi.fn<(props: SearchableEntityPickerProps) => void>(),
}));

/** The props of the most recent combobox render. */
function lastPickerProps(): SearchableEntityPickerProps | undefined {
	return renderedPicker.mock.lastCall?.[LIST_SLOT_INDEX.first];
}

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { auth: { adminUsers: { useQuery: listQuery }, adminUserDetail: { useQuery: detailQuery } } } }),
}));

/** Captures what the picker hands the data-agnostic combobox. */
function SearchableEntityPickerStub(props: SearchableEntityPickerProps): React.JSX.Element {
	renderedPicker(props);
	return <div id={props.id} />;
}

vi.mock("@/components/common/searchable-entity-picker", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/components/common/searchable-entity-picker")>()),
	SearchableEntityPicker: SearchableEntityPickerStub,
}));

function noop(): void {
	return;
}

beforeEach((): void => {
	listQuery.mockReturnValue({
		data: { data: [{ id: REFERRER_ID, fullName: "Alice Referrer", email: "alice@example.com" }] },
		isFetching: false,
		isError: false,
	});
	detailQuery.mockReturnValue({ data: undefined });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("ReferrerPicker", () => {
	it("searches users server-side with a capped page and offers name and email", () => {
		render(<ReferrerPicker id="referrer" value="" onChange={noop} />);

		expect(listQuery).toHaveBeenLastCalledWith({ page: 1, limit: REFERRER_PICKER_RESULT_LIMIT });
		expect(lastPickerProps()?.options).toEqual([{ id: REFERRER_ID, label: "Alice Referrer (alice@example.com)" }]);
		expect(detailQuery).toHaveBeenLastCalledWith({ userId: "" }, { enabled: false });
	});

	it("sends the typed text as the search", () => {
		render(<ReferrerPicker id="referrer" value="" onChange={noop} />);

		act((): void => {
			lastPickerProps()?.onSearch("  alice ");
		});

		expect(listQuery).toHaveBeenLastCalledWith({ page: 1, limit: REFERRER_PICKER_RESULT_LIMIT, search: "alice" });
	});

	it("labels a pre-filled referrer id from the user detail", () => {
		detailQuery.mockReturnValue({ data: { data: { id: REFERRER_ID, fullName: "Alice Referrer" } } });

		render(<ReferrerPicker id="referrer" value={REFERRER_ID} onChange={noop} />);

		expect(detailQuery).toHaveBeenLastCalledWith({ userId: REFERRER_ID }, { enabled: true });
		expect(lastPickerProps()?.selectedLabel).toBe("Alice Referrer");
	});

	it("hands the chosen user id to the caller", () => {
		const onChange = vi.fn<(userId: string) => void>();
		render(<ReferrerPicker id="referrer" value="" onChange={onChange} />);

		lastPickerProps()?.onChange(REFERRER_ID);

		expect(onChange).toHaveBeenCalledWith(REFERRER_ID);
	});
});
