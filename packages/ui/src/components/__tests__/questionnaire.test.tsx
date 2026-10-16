// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabelsOverride } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoiceDescription,
	QuestionnaireChoices,
	QuestionnaireError,
	QuestionnaireInput,
	QuestionnaireItem,
	QuestionnaireNext,
	QuestionnairePrevious,
	QuestionnaireProgress,
	QuestionnaireSkip,
	QuestionnaireSubmit,
	QuestionnaireTitle,
	type QuestionnaireProgressRender,
} from "./questionnaire";

const LABELS = UI_KIT_LABELS_EN.questionnaire;
const FRENCH_NAV: UiKitLabelsOverride<"questionnaire"> = { next: "Suivant", progress: (current: number, total: number): string => `${String(current)} / ${String(total)}` };

afterEach((): void => {
	cleanup();
});

interface SurveyProps {
	readonly labels?: UiKitLabelsOverride<"questionnaire"> | undefined;
	readonly onSubmit?: ((event: React.SyntheticEvent<HTMLFormElement>) => void) | undefined;
	readonly formRef?: React.Ref<HTMLFormElement> | undefined;
	readonly progressRender?: QuestionnaireProgressRender | undefined;
}

function preventSubmit(event: React.SyntheticEvent<HTMLFormElement>): void {
	event.preventDefault();
}

function Survey({ labels, onSubmit = preventSubmit, formRef, progressRender }: SurveyProps): React.JSX.Element {
	return (
		<Questionnaire ref={formRef} labels={labels} onSubmit={onSubmit}>
			<QuestionnaireProgress render={progressRender} />
			<QuestionnaireItem name="plan" required>
				<QuestionnaireTitle>Which plan?</QuestionnaireTitle>
				<QuestionnaireChoices>
					<QuestionnaireChoice value="free">
						Free
						<QuestionnaireChoiceDescription>For hobbyists</QuestionnaireChoiceDescription>
					</QuestionnaireChoice>
					<QuestionnaireChoice value="pro">Pro</QuestionnaireChoice>
				</QuestionnaireChoices>
				<QuestionnaireError />
			</QuestionnaireItem>
			<QuestionnaireItem name="note">
				<QuestionnaireTitle>Anything else?</QuestionnaireTitle>
				<QuestionnaireInput aria-label="Note" />
				<QuestionnaireError />
			</QuestionnaireItem>
			<QuestionnaireActions>
				<QuestionnairePrevious />
				<QuestionnaireSkip />
				<QuestionnaireNext />
				<QuestionnaireSubmit />
			</QuestionnaireActions>
		</Questionnaire>
	);
}

function renderSurvey(props: SurveyProps = {}): void {
	render(<Survey {...props} />, { wrapper: UiKitTestProviders });
}

describe("Questionnaire", () => {
	it("shows the first question with localized progress and navigation", (): void => {
		renderSurvey();
		const progress = screen.getByRole("progressbar", { name: LABELS.progressLabel });
		expect(progress.textContent).toBe(LABELS.progress(1, 2));
		expect(progress.getAttribute("aria-valuetext")).toBe(LABELS.progress(1, 2));
		expect(screen.getByRole("group", { name: "Which plan?" })).toBeTruthy();
		expect(screen.getByRole("button", { name: LABELS.next })).toBeTruthy();
		/* First item: no Previous; required item: no Skip; not last: no Submit. */
		expect(screen.queryByRole("button", { name: LABELS.previous })).toBeNull();
		expect(screen.queryByRole("button", { name: LABELS.skip })).toBeNull();
		expect(screen.queryByRole("button", { name: LABELS.submit })).toBeNull();
	});

	it("blocks Next on an unanswered required question with the required message", (): void => {
		renderSurvey();
		fireEvent.click(screen.getByRole("button", { name: LABELS.next }));
		expect(screen.getByRole("alert").textContent).toBe(LABELS.errorRequired);
		expect(screen.getByRole("group", { name: "Which plan?" })).toBeTruthy();
	});

	it("moves on once answered, then offers Previous, Skip and Submit on the optional last question", (): void => {
		renderSurvey();
		const pro = screen.getByRole<HTMLInputElement>("radio", { name: "Pro" });
		fireEvent.click(pro);
		expect(pro.checked).toBe(true);
		expect(pro.closest('[data-slot="questionnaire-choice"]')?.hasAttribute("data-checked")).toBe(true);

		fireEvent.click(screen.getByRole("button", { name: LABELS.next }));
		expect(screen.getByRole("group", { name: "Anything else?" })).toBeTruthy();
		expect(screen.getByRole("progressbar").textContent).toBe(LABELS.progress(2, 2));
		expect(screen.getByRole("button", { name: LABELS.previous })).toBeTruthy();
		expect(screen.getByRole("button", { name: LABELS.skip })).toBeTruthy();
		expect(screen.getByRole("button", { name: LABELS.submit })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: LABELS.previous }));
		expect(screen.getByRole("group", { name: "Which plan?" })).toBeTruthy();
	});

	it("uses the optional message for an optional question", (): void => {
		render(
			<Questionnaire onSubmit={preventSubmit}>
				<QuestionnaireItem name="note">
					<QuestionnaireTitle>Note</QuestionnaireTitle>
					<QuestionnaireInput aria-label="Note" />
					<QuestionnaireError />
				</QuestionnaireItem>
			</Questionnaire>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByText(LABELS.errorOptional, { selector: "p" }).dataset.slot).toBe("questionnaire-error");
	});

	it("lets the root override copy for every part", (): void => {
		renderSurvey({ labels: FRENCH_NAV });
		expect(screen.getByRole("button", { name: "Suivant" })).toBeTruthy();
		expect(screen.getByRole("progressbar").textContent).toBe("1 / 2");
	});

	it("passes localized value text to a custom progress render", (): void => {
		const progressRender: QuestionnaireProgressRender = (props, state): React.ReactElement => (
			<div {...props} data-testid="custom-progress">
				{`${String(state.current)}-${String(state.total)}`}
			</div>
		);
		renderSurvey({ progressRender });
		const progress = screen.getByTestId("custom-progress");
		expect(progress.textContent).toBe("1-2");
		expect(progress.getAttribute("aria-valuetext")).toBe(LABELS.progress(1, 2));
		expect(progress.getAttribute("role")).toBe("progressbar");
	});

	it("styles navigation as buttons, with variant, size and className merged last", (): void => {
		render(
			<Questionnaire>
				<QuestionnaireItem name="only">
					<QuestionnaireTitle>Only</QuestionnaireTitle>
				</QuestionnaireItem>
				<QuestionnaireSubmit variant="secondary" size="sm" className="justify-self-start">
					Send
				</QuestionnaireSubmit>
			</Questionnaire>,
			{ wrapper: UiKitTestProviders },
		);
		const submit = screen.getByRole("button", { name: "Send" });
		expect(submit.className).toContain("bg-secondary");
		expect(submit.className).toContain("h-9");
		expect(submit.className).toContain("justify-self-start");
		expect(submit.className).not.toContain("justify-self-end");
		expect(submit.dataset.variant).toBe("secondary");
	});

	it("submits from the last question and forwards the form ref", (): void => {
		const onSubmit = vi.fn(preventSubmit);
		const formRef = React.createRef<HTMLFormElement>();
		renderSurvey({ onSubmit, formRef });
		expect(formRef.current?.tagName).toBe("FORM");

		fireEvent.click(screen.getByRole("radio", { name: /^Free/ }));
		fireEvent.click(screen.getByRole("button", { name: LABELS.next }));
		fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "Thanks" } });
		fireEvent.click(screen.getByRole("button", { name: LABELS.submit }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("needs a UiKitLabelsProvider", (): void => {
		const consoleError = vi.spyOn(console, "error").mockImplementation((): void => undefined);
		expect((): void => {
			render(<Survey />);
		}).toThrow(/UiKitLabelsProvider/);
		consoleError.mockRestore();
	});
});
