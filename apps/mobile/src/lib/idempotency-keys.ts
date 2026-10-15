// The Idempotency-Key a write is sent with (ADR 052; the API's ledger). One
// key per thing the person is sending: the same text sent again after a
// failure reuses its key, so the API answers the first result instead of
// posting twice; changed text is a new request and gets a new key (the API
// refuses a key reused for a different body); a success spends the key.

import * as Crypto from "expo-crypto";
import * as React from "react";

/** Remembers the key of the one payload being sent. Pure apart from `createKey`, so tested without React. */
export class IdempotencyKeyRing {
	private _current: { readonly payload: string; readonly key: string } | null = null;

	public constructor(private readonly _createKey: () => string) {}

	/** The key for `payload` (a stable serialization of what is sent): the same as last time for the same payload. */
	public keyFor(payload: string): string {
		if (this._current?.payload !== payload) {
			this._current = { payload, key: this._createKey() };
		}
		return this._current.key;
	}

	/** The send succeeded: the next payload — even an identical one — is a new request. */
	public spend(): void {
		this._current = null;
	}
}

/** A key ring for one composer, for the life of the screen. */
export function useIdempotencyKeys(): IdempotencyKeyRing {
	const [ring] = React.useState((): IdempotencyKeyRing => new IdempotencyKeyRing(Crypto.randomUUID));
	return ring;
}
