import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { TextInstance, ViewInstance } from "react-native";

import { Button } from "../button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../card";
import { BodyText } from "../text";

const TITLE = "Devices";
const DESCRIPTION = "Where you are signed in.";
const BODY = "Two devices";

describe("Card", () => {
	it("draws a header from its title and description", async () => {
		await render(
			<Card title={TITLE} description={DESCRIPTION} testID="card">
				<BodyText>{BODY}</BodyText>
			</Card>,
		);

		expect(screen.getByRole("header", { name: TITLE })).toBeOnTheScreen();
		expect(screen.getByText(DESCRIPTION)).toBeOnTheScreen();
		expect(screen.getByTestId("card")).toHaveTextContent(`${TITLE}${DESCRIPTION}${BODY}`);
	});

	it("leaves the header out without a title", async () => {
		await render(
			<Card description={DESCRIPTION}>
				<BodyText>{BODY}</BodyText>
			</Card>,
		);

		expect(screen.queryByRole("header")).toBeNull();
		expect(screen.queryByText(DESCRIPTION)).toBeNull();
	});

	it("composes from its parts, as on the web", async () => {
		const onPress = jest.fn();
		await render(
			<Card>
				<CardHeader>
					<CardTitle>{TITLE}</CardTitle>
					<CardDescription>{DESCRIPTION}</CardDescription>
				</CardHeader>
				<CardContent>
					<BodyText>{BODY}</BodyText>
				</CardContent>
				<CardFooter>
					<Button label="Manage" onPress={onPress} />
				</CardFooter>
			</Card>,
		);

		expect(screen.getByRole("header", { name: TITLE })).toBeOnTheScreen();
		expect(screen.getByText(BODY)).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Manage" })).toBeOnTheScreen();
	});

	it("has a compact size", async () => {
		await render(
			<Card size="sm" testID="card">
				<BodyText>{BODY}</BodyText>
			</Card>,
		);
		expect(String(screen.getByTestId("card").props.className).split(" ")).toContain("p-3");
	});

	it("forwards the ref of every part", async () => {
		const card = React.createRef<ViewInstance>();
		const header = React.createRef<ViewInstance>();
		const title = React.createRef<TextInstance>();
		const description = React.createRef<TextInstance>();
		const content = React.createRef<ViewInstance>();
		const footer = React.createRef<ViewInstance>();
		await render(
			<Card ref={card}>
				<CardHeader ref={header}>
					<CardTitle ref={title}>{TITLE}</CardTitle>
					<CardDescription ref={description}>{DESCRIPTION}</CardDescription>
				</CardHeader>
				<CardContent ref={content}>
					<BodyText>{BODY}</BodyText>
				</CardContent>
				<CardFooter ref={footer}>
					<BodyText>{BODY}</BodyText>
				</CardFooter>
			</Card>,
		);

		for (const ref of [card, header, title, description, content, footer]) {
			expect(ref.current).not.toBeNull();
		}
	});

	it("merges the caller's className last, on the card and its parts", async () => {
		await render(
			<Card className="p-6" testID="card">
				<CardTitle className="text-base" testID="title">
					{TITLE}
				</CardTitle>
			</Card>,
		);

		const cardClassName = String(screen.getByTestId("card").props.className).split(" ");
		expect(cardClassName).toContain("p-6");
		expect(cardClassName).not.toContain("p-4");
		const titleClassName = String(screen.getByTestId("title").props.className).split(" ");
		expect(titleClassName).toContain("text-base");
		expect(titleClassName).not.toContain("text-lg");
	});
});
