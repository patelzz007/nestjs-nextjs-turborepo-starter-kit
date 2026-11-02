import { describeOffer, offerDetails } from "../offer-terms";

const LATTE = { name: "Latte (12 oz)", sku: "BEV-LATTE-12OZ" };

describe("describeOffer", () => {
	it("says what each kind of reward gives, as the cashier applies it", () => {
		expect(describeOffer({ type: "DISCOUNT", percentOff: 15 })).toBe("15% off the bill");
		expect(describeOffer({ type: "CASHBACK", amountMinor: 500, currency: "MYR" })).toMatch(/^RM\s?5\.00 cashback$/u);
		expect(describeOffer({ type: "POINTS", points: 1200 })).toBe("1,200 bonus points");
		expect(describeOffer({ type: "FREE_ITEM", quantity: 2, item: LATTE })).toBe("2 × Latte (12 oz) free");
		expect(describeOffer({ type: "BOGO", freeQuantity: 1, item: LATTE })).toBe("Buy a Latte (12 oz), get 1 free");
	});
});

describe("offerDetails", () => {
	it("adds the item and its SKU for a reward that gives one", () => {
		expect(offerDetails({ type: "FREE_ITEM", quantity: 1, item: LATTE })).toEqual([
			{ label: "Gives", value: "1 × Latte (12 oz) free" },
			{ label: "Item", value: "Latte (12 oz)" },
			{ label: "SKU", value: "BEV-LATTE-12OZ" },
		]);
		expect(offerDetails({ type: "BOGO", freeQuantity: 1, item: LATTE }).map((detail) => detail.label)).toEqual(["Gives", "Item", "SKU"]);
	});

	it("is the one line for a discount, cashback or points", () => {
		expect(offerDetails({ type: "DISCOUNT", percentOff: 10 })).toEqual([{ label: "Gives", value: "10% off the bill" }]);
		expect(offerDetails({ type: "POINTS", points: 50 })).toHaveLength(1);
		expect(offerDetails({ type: "CASHBACK", amountMinor: 100, currency: "MYR" })).toHaveLength(1);
	});
});
