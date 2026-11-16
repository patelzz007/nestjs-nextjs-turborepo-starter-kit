// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";
import { Questionnaire1Example } from "@/components/component-showcase/examples/questionnaire/questionnaire-1";

const FIRST_QUESTION = "What will you use the workspace for?";
const SECOND_QUESTION = "How many people will join you?";

/** The `<fieldset>` a question's title belongs to; only the active one is shown. */
function questionFieldset(title: string): HTMLFieldSetElement | null {
	return screen.getByText(title).closest("fieldset");
}

describe("Questionnaire guided setup (c-questionnaire-1)", (): void => {
	installJsdomUiShims();

	it("starts on the first question and advances to the second once it is answered", (): void => {
		render(<Questionnaire1Example />, { wrapper: UiKitTestProviders });

		expect(questionFieldset(FIRST_QUESTION)?.hidden).toBe(false);
		expect(questionFieldset(SECOND_QUESTION)?.hidden).toBe(true);

		fireEvent.click(screen.getByRole("radio", { name: /Shipping product work/ }));
		fireEvent.click(screen.getByRole("button", { name: "Next" }));

		expect(questionFieldset(FIRST_QUESTION)?.hidden).toBe(true);
		expect(questionFieldset(SECOND_QUESTION)?.hidden).toBe(false);
	});

	it("keeps the visitor on an unanswered required question and shows its error", (): void => {
		render(<Questionnaire1Example />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: "Next" }));

		expect(questionFieldset(FIRST_QUESTION)?.hidden).toBe(false);
		expect(screen.getByRole("alert")).toBeDefined();
	});
});
