import { addLocalDays } from "@workspace/shared";
import { fireEvent, screen, within } from "expo-router/testing-library";
import * as Haptics from "expo-haptics";

import { ok, stubApi, type ApiStub } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../test/app-harness";
import { profileJson, userJson } from "../../../test/fixtures";
import { testAccessToken } from "../../../test/jwt";
import AppTabsLayout from "../../app/(app)/_layout";
import AnalyticsScreen from "../../app/(app)/analytics";
import HomeScreen from "../../app/(app)/index";
import { activityRangeOfDays, activityToday } from "../../features/analytics/activity-range";
import { rangeLabelOf } from "../../features/analytics/presentation";
import { addCalendarMonths, calendarMonthOf, firstDayOf } from "../../lib/calendar";

const TAB_SCREENS = {
	"(app)/_layout": AppTabsLayout,
	"(app)/index": HomeScreen,
	"(app)/analytics": AnalyticsScreen,
	"(app)/search": markerScreen("search"),
	"(app)/profile": markerScreen("profile"),
	"(app)/settings": markerScreen("settings"),
};

/** Chart labels and readouts are hidden from screen readers (the plot speaks for them): query them anyway. */
const HIDDEN = { includeHiddenElements: true };

function stubAccount(): ApiStub {
	return stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()) });
}

async function renderAnalytics(): Promise<void> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, TAB_SCREENS, "/analytics");
	await screen.findByTestId("analytics-screen");
}

describe("Analytics screen", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("is the second tab, titled Analytics", async () => {
		stubAccount();
		await renderAnalytics();

		const tabs = screen.getAllByRole("tab");
		expect(tabs).toHaveLength(5);
		const [, analytics] = tabs;
		expect(analytics).toHaveAccessibleName("Analytics");
		expect(screen.getByRole("tab", { name: "Analytics" })).toBeSelected();
	});

	it("shows the last 30 days by default, marked as sample data, without asking the API for anything", async () => {
		const api = stubAccount();
		await renderAnalytics();

		expect(screen.getByRole("radio", { name: "Last 30 days" })).toBeChecked();
		expect(screen.getByText("Sample data")).toBeOnTheScreen();
		expect(screen.getByTestId("analytics-range-label")).toHaveTextContent(/^\d{1,2} \w+ – \d{1,2} \w+ \d{4} · UTC$/u);
		expect(api.callsTo("GET /claims/analytics/dashboard")).toHaveLength(0);
		expect(api.calls.filter((call): boolean => call.path.includes("analytics"))).toHaveLength(0);
	});

	it("leads with what was spent, then the four activity KPIs, each against the previous period", async () => {
		stubAccount();
		await renderAnalytics();

		expect(screen.getByTestId("analytics-headline")).toHaveAccessibleName(/^Total spent: RM\s[\d,]+\.\d{2}\. .+/u);
		const kpis = screen.getByTestId("analytics-kpis");
		for (const label of ["Shop visits", "Average bill", "Rewards claimed", "Redemption rate"]) {
			expect(within(kpis).getByLabelText(new RegExp(`^${label}: `, "u"))).toBeOnTheScreen();
		}
		expect(screen.getAllByText("vs previous 30 days").length).toBeGreaterThan(0);
	});

	it("shows the charts and breakdowns of the web's My Activity page", async () => {
		stubAccount();
		await renderAnalytics();

		expect(screen.getByLabelText("Spending over time")).toBeOnTheScreen();
		expect(screen.getByLabelText("Claimed vs redeemed")).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Your claims by status" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Where you spent the most" })).toBeOnTheScreen();
		const referrals = screen.getByTestId("analytics-referrals");
		for (const label of ["Referrals sent", "Referrals credited", "Rewards earned"]) {
			expect(within(referrals).getByLabelText(new RegExp(`^${label}: \\d+$`, "u"))).toBeOnTheScreen();
		}
	});

	it("switches the range: the label, the comparison and the buckets follow", async () => {
		stubAccount();
		await renderAnalytics();

		await fireEvent.press(screen.getByRole("radio", { name: "Last 7 days" }));

		expect(screen.getByRole("radio", { name: "Last 7 days" })).toBeChecked();
		expect(screen.getAllByText("vs previous 7 days").length).toBeGreaterThan(0);
		await fireEvent.press(screen.getByTestId("analytics-spending-chart-values-toggle"));
		expect(within(screen.getByTestId("analytics-spending")).getAllByLabelText(/^\w{3}, \d{1,2} \w+: Spent RM/u)).toHaveLength(7);

		await fireEvent.press(screen.getByRole("radio", { name: "Last 90 days" }));
		expect(screen.getAllByText("Touch the chart to see each week", HIDDEN).length).toBe(2);
	});

	it("lists a chart's values as a table on request, with a total, and hides them again", async () => {
		stubAccount();
		await renderAnalytics();

		const toggle = screen.getByTestId("analytics-engagement-chart-values-toggle");
		expect(toggle).toHaveAccessibleName("Show values");
		await fireEvent.press(toggle);
		expect(screen.getByTestId("analytics-engagement-chart-values-toggle")).toHaveAccessibleName("Hide values");
		const table = screen.getByTestId("analytics-engagement-chart-values");
		expect(within(table).getAllByLabelText(/^\w{3}, \d{1,2} \w+: Claimed \d+, Redeemed \d+$/u)).toHaveLength(30);
		expect(within(table).getByLabelText(/^Total: Claimed \d+, Redeemed \d+$/u)).toBeOnTheScreen();
		expect(within(table).getByText("Day", HIDDEN)).toBeOnTheScreen();

		await fireEvent.press(screen.getByTestId("analytics-engagement-chart-values-toggle"));
		expect(screen.queryByTestId("analytics-engagement-chart-values")).toBeNull();
	});

	it("adds highlights, the period comparison, budget, stamp cards and recent visits", async () => {
		stubAccount();
		await renderAnalytics();

		const highlights = screen.getByTestId("analytics-highlights");
		for (const label of ["Busiest day", "Favourite shop", "Biggest bill", "Saved with rewards"]) {
			expect(within(highlights).getByLabelText(new RegExp(`^${label}: `, "u"))).toBeOnTheScreen();
		}
		expect(screen.getByLabelText("Legend: Last 30 days, Previous 30 days")).toBeOnTheScreen();
		expect(screen.getByLabelText(/^Spent: RM[\s\d,.]+, Previous 30 days RM/u)).toBeOnTheScreen();
		expect(screen.getByRole("progressbar", { name: "Monthly budget used" })).toBeOnTheScreen();
		expect(within(screen.getByTestId("analytics-stamp-cards")).getAllByRole("progressbar").length).toBeGreaterThan(0);
		expect(within(screen.getByTestId("analytics-recent-visits")).getAllByLabelText(/, RM[\s\d,.]+, \w{3}, \d{1,2} \w+ · /u)).toHaveLength(6);
	});

	it("shows when the customer shops and spends: by weekday, by time of day and by category", async () => {
		stubAccount();
		await renderAnalytics();

		const weekdays = screen.getByTestId("analytics-weekdays");
		expect(within(weekdays).getAllByRole("button", { name: /^\w+day: \d+ visits?$/u })).toHaveLength(7);
		expect(within(screen.getByTestId("analytics-visit-times")).getAllByRole("button")).toHaveLength(28);
		expect(screen.getByLabelText(/^Spending by time of day: RM[\s\d,.]+ spent\. Morning [\d.]+%, Midday/u)).toBeOnTheScreen();
		expect(within(screen.getByTestId("analytics-categories")).getAllByLabelText(/: RM[\s\d,.]+, [\d.]+% · \d+ visits?$/u).length).toBeGreaterThan(0);
	});

	it("reads out the weekday and the time of day tapped", async () => {
		stubAccount();
		await renderAnalytics();

		const saturday = within(screen.getByTestId("analytics-weekdays")).getByRole("button", { name: /^Saturday: /u });
		await fireEvent.press(saturday);
		expect(within(screen.getByTestId("analytics-weekdays")).getByRole("button", { name: /^Saturday: /u })).toBeSelected();
		expect(within(screen.getByTestId("analytics-weekdays")).getByText("Saturday", HIDDEN)).toBeOnTheScreen();

		await fireEvent.press(screen.getByTestId("analytics-visit-times-evening-sunday"));
		expect(within(screen.getByTestId("analytics-visit-times")).getByText(/^Evening .+ · Sunday$/u, HIDDEN)).toBeOnTheScreen();
	});

	it("shows any start and end date picked on the calendar", async () => {
		stubAccount();
		await renderAnalytics();
		const lastMonth = addCalendarMonths(calendarMonthOf(activityToday(Date.now())), -1);
		const from = firstDayOf(lastMonth);
		const to = addLocalDays(from, 14);

		await fireEvent.press(screen.getByRole("radio", { name: "Custom dates" }));
		expect(screen.getByText("Choose dates")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Previous month" }));
		await fireEvent.press(screen.getByTestId(`day-${from}`));
		expect(screen.getByTestId("analytics-date-picker-apply")).toBeDisabled();
		await fireEvent.press(screen.getByTestId(`day-${to}`));
		expect(screen.getByText("15 days")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("analytics-date-picker-apply"));

		const range = activityRangeOfDays(from, to);
		expect(screen.queryByText("Choose dates")).toBeNull();
		expect(screen.getByRole("radio", { name: "Custom dates" })).toBeChecked();
		expect(screen.getByTestId("analytics-range-label")).toHaveTextContent(`${rangeLabelOf(range)} · UTC`);
		expect(screen.getAllByText("vs previous 15 days").length).toBeGreaterThan(0);
		expect(screen.getByLabelText(`Legend: ${rangeLabelOf(range)}, ${rangeLabelOf({ from: range.previousFrom, to: range.previousTo, timeZone: "UTC" })}`)).toBeOnTheScreen();
	});

	it("keeps the range it had when the calendar is closed without applying", async () => {
		stubAccount();
		await renderAnalytics();

		await fireEvent.press(screen.getByTestId("analytics-range-button"));
		expect(screen.getByText("Choose dates")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Close choose dates" }));

		expect(screen.queryByText("Choose dates")).toBeNull();
		expect(screen.getByRole("radio", { name: "Last 30 days" })).toBeChecked();
	});
});
