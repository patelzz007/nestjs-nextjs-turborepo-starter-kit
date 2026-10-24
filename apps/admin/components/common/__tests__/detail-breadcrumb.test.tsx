// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { breadcrumbPageLabel } from "@workspace/ui/components/breadcrumb-context";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminBreadcrumbProvider, useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";
import { DetailBreadcrumb } from "@/components/common/detail-breadcrumb";

const PATH = "/components/kanban-board/tasks/0199d0c0-0000-7000-8000-0000000000c1";

function PageLabel(): React.JSX.Element {
	const { status } = useAdminBreadcrumb();
	return <output aria-label="Page">{breadcrumbPageLabel(status) ?? ""}</output>;
}

function Page({ label }: { readonly label?: string | undefined }): React.JSX.Element {
	return (
		<AdminBreadcrumbProvider pathname={PATH}>
			<DetailBreadcrumb label={label} />
			<PageLabel />
		</AdminBreadcrumbProvider>
	);
}

afterEach(() => {
	cleanup();
});

describe("DetailBreadcrumb", () => {
	it("names the final crumb once the record has loaded, and gives it back when it leaves", () => {
		const { rerender } = render(<Page />, { wrapper: UiKitTestProviders });
		const routeLabel = screen.getByRole("status", { name: "Page" }).textContent;
		expect(routeLabel).not.toBe("Ship the board");

		rerender(<Page label="Ship the board" />);
		expect(screen.getByRole("status", { name: "Page" }).textContent).toBe("Ship the board");

		rerender(<Page />);
		expect(screen.getByRole("status", { name: "Page" }).textContent).toBe(routeLabel);
	});
});
