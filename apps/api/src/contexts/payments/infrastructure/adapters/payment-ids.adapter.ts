import { newRowId } from "@workspace/shared";

import type { PaymentIdsPort } from "../../application/ports/payment-ids.port";

/** New row ids for payments and their events (`newRowId`, the repository-wide row id). */
export class PaymentIdsAdapter implements PaymentIdsPort {
	public next(): string {
		return newRowId();
	}
}
