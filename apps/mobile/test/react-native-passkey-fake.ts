// react-native-passkey under Jest (jest.setup.ts mocks "react-native-passkey" with this module): the phone's
// credential manager is native. By default the phone has no passkey support; a test switches it on
// (`supportPasskeys`), queues what the next create or get answers (`answerNextCreate`, `answerNextGet`) or how
// it rejects (`rejectNext`, with the module's own `{ error, message }` shape), and reads every request it was
// given (`requests`). Reset before every test.

import type { PasskeyCreateRequest, PasskeyCreateResult, PasskeyGetRequest, PasskeyGetResult } from "react-native-passkey";

/** One request a test can inspect. */
export type RecordedPasskeyRequest = { readonly kind: "create"; readonly request: PasskeyCreateRequest } | { readonly kind: "get"; readonly request: PasskeyGetRequest };

/** How the module rejects: an object naming the error (`{ error, message }`), which is what the app reads. */
export interface FakePasskeyError {
	readonly error: string;
	readonly message: string;
}

/** The module's rejection, carried by an `Error` so the fake rejects as lint requires; the app reads only the two fields. */
class PasskeyModuleRejection extends Error {
	public constructor(
		public readonly error: string,
		message: string,
	) {
		super(message);
	}
}

let supported = false;
let nextCreate: PasskeyCreateResult | null = null;
let nextGet: PasskeyGetResult | null = null;
let nextRejection: FakePasskeyError | null = null;
const recorded: RecordedPasskeyRequest[] = [];

function answer<TResult>(result: TResult | null): Promise<TResult> {
	if (nextRejection !== null) {
		const rejection = nextRejection;
		nextRejection = null;
		return Promise.reject(new PasskeyModuleRejection(rejection.error, rejection.message));
	}
	if (result === null) {
		return Promise.reject(new PasskeyModuleRejection("NoCredentials", "No answer was queued for this request"));
	}
	return Promise.resolve(result);
}

export const Passkey = {
	isSupported: (): boolean => supported,
	create: (request: PasskeyCreateRequest): Promise<PasskeyCreateResult> => {
		recorded.push({ kind: "create", request });
		const result = nextCreate;
		nextCreate = null;
		return answer(result);
	},
	get: (request: PasskeyGetRequest): Promise<PasskeyGetResult> => {
		recorded.push({ kind: "get", request });
		const result = nextGet;
		nextGet = null;
		return answer(result);
	},
};

export function supportPasskeys(): void {
	supported = true;
}

export function answerNextCreate(result: PasskeyCreateResult): void {
	nextCreate = result;
}

export function answerNextGet(result: PasskeyGetResult): void {
	nextGet = result;
}

export function rejectNext(error: FakePasskeyError): void {
	nextRejection = error;
}

export function requests(): readonly RecordedPasskeyRequest[] {
	return [...recorded];
}

export function reset(): void {
	supported = false;
	nextCreate = null;
	nextGet = null;
	nextRejection = null;
	recorded.length = 0;
}
