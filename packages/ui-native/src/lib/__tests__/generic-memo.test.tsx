import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { memo } from "../generic-memo";

interface ItemProps<TItem extends { readonly name: string }> {
	readonly item: TItem;
	readonly onRender: (item: TItem) => void;
}

function ItemBase<TItem extends { readonly name: string }>({ item, onRender }: ItemProps<TItem>): React.JSX.Element {
	onRender(item);
	return <Text>{item.name}</Text>;
}

const Item = memo(ItemBase);

interface Tagged {
	readonly name: string;
	readonly tag: number;
}

const ADA: Tagged = { name: "Ada", tag: 1 };
const GRACE: Tagged = { name: "Grace", tag: 2 };

describe("memo", () => {
	it("skips a render when the props are the same, and keeps the component's type parameter", async () => {
		const record = jest.fn<undefined, [Tagged]>();
		const view = await render(<Item item={ADA} onRender={record} />);
		await view.rerender(<Item item={ADA} onRender={record} />);
		expect(record.mock.calls).toStrictEqual([[ADA]]);
		await view.rerender(<Item item={GRACE} onRender={record} />);
		expect(screen.getByText("Grace")).toBeOnTheScreen();
		expect(record.mock.calls).toStrictEqual([[ADA], [GRACE]]);
	});
});
