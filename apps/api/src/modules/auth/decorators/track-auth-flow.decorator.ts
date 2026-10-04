import { AsyncLocalStorage } from "node:async_hooks";

import { AuthFlowEventSchema, CaughtValueSchema, type ApiErrorCode, type AuthFlowEvent, type CaughtValue } from "@workspace/shared";

import { mapException } from "../../../common/errors/exception-mapper";
import { AuthEventsService } from "../services/auth-events.service";

/** Extracts the client type ("web" | "admin" | …) from the decorated method's arguments. */
type ClientTypeExtractor = (...args: readonly AuthFlowMethodArg[]) => string | null | undefined;

/** Any runtime value a decorated method can receive as an argument. */
export type AuthFlowMethodArg = object | string | number | boolean | bigint | symbol | null | undefined;

/** Host instance of a decorated method; `authEvents` is injected by Nest. */
interface AuthFlowHost {
	readonly authEvents?: AuthEventsService;
}

type AuthFlowMethod<TArgs extends AuthFlowMethodArg[], TResult extends AuthFlowMethodArg> = (this: AuthFlowHost, ...args: TArgs) => Promise<TResult>;

type AuthFlowMethodDecorator = <TArgs extends AuthFlowMethodArg[], TResult extends AuthFlowMethodArg>(
	target: object,
	propertyKey: string | symbol,
	descriptor: TypedPropertyDescriptor<AuthFlowMethod<TArgs, TResult>>,
) => TypedPropertyDescriptor<AuthFlowMethod<TArgs, TResult>>;

interface TrackAuthFlowOptions {
	/** The auth flow name — one of the `AuthFlowEvent` flows. */
	readonly flow: AuthFlowEvent["flow"];
	/**
	 * Optional: extract the client type from the method arguments.
	 * Defaults to `null` (not a client-type-specific flow).
	 */
	readonly clientType?: ClientTypeExtractor;
}

/**
 * Exception mapping used to derive the recorded error CODE. Internal error
 * text is never exposed — the event carries the stable code only.
 */
const ERROR_CODE_MAPPING_OPTIONS = { exposeInternalErrors: false } satisfies Parameters<typeof mapException>[1];

/** Recorded when the thrown value is not even a recognizable runtime value. */
const UNRECOGNIZED_ERROR_CODE: ApiErrorCode = "INTERNAL_ERROR";

/**
 * Per-invocation subject of one tracked flow. The decorated method names the
 * user it acted on via {@link identifyAuthFlowSubject} as soon as it knows
 * it — so the event carries the user on success AND on a failure that happens
 * after the user was resolved (wrong password, lockout, reused password, …).
 */
class AuthFlowSubject {
	private userId: string | null = null;

	public identify(userId: string): void {
		this.userId = userId;
	}

	public get identifiedUserId(): string | null {
		return this.userId;
	}
}

const authFlowSubjectScope = new AsyncLocalStorage<AuthFlowSubject>();

/** Thrown when the tracking contract is violated — always a programming error. */
export class AuthFlowTrackingError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "AuthFlowTrackingError";
	}
}

/**
 * Names the user the current `@TrackAuthFlow` method acts on. Call it as soon
 * as the method has resolved the user (also before throwing a failure that
 * concerns a known user). Calling it outside a tracked method is a bug and
 * throws, so a mis-wired call can never silently record nothing.
 */
export function identifyAuthFlowSubject(userId: string): void {
	const subject = authFlowSubjectScope.getStore();
	if (subject === undefined) {
		throw new AuthFlowTrackingError("identifyAuthFlowSubject() must be called inside a @TrackAuthFlow method");
	}
	subject.identify(userId);
}

/**
 * Stable machine-readable code of a flow failure — the same code the global
 * exception filter sends to the client (`INVALID_CREDENTIALS`,
 * `UNAUTHORIZED`, `INTERNAL_ERROR`, …), never the human-readable message.
 */
export function authFlowErrorCode(caught: CaughtValue): ApiErrorCode {
	return mapException(caught, ERROR_CODE_MAPPING_OPTIONS).code;
}

/**
 * Declarative decorator that wraps a method and durably records an
 * `AuthFlowEvent` (outbox `auth.flow`) on both success and failure, with
 * accurate timing. The host class MUST inject `authEvents: AuthEventsService`
 * — a host without it throws {@link AuthFlowTrackingError} instead of
 * silently recording nothing.
 *
 * The recorded `userId` is whatever the method passed to
 * {@link identifyAuthFlowSubject} (null when the flow never resolved a user,
 * e.g. forgot-password for an unknown email). The recorded `error` is the
 * failure's stable error code.
 *
 * @example
 *   @TrackAuthFlow({ flow: "change-password" })
 *   public async changePassword(userId: string, dto: ChangePasswordInput): Promise<ChangePasswordResponse> {
 *       identifyAuthFlowSubject(userId);
 *       // ...
 *   }
 */
export function TrackAuthFlow(options: TrackAuthFlowOptions): AuthFlowMethodDecorator {
	const { flow, clientType: clientTypeExtractor } = options;

	return function <TArgs extends AuthFlowMethodArg[], TResult extends AuthFlowMethodArg>(
		_target: object,
		propertyKey: string | symbol,
		descriptor: TypedPropertyDescriptor<AuthFlowMethod<TArgs, TResult>>,
	): TypedPropertyDescriptor<AuthFlowMethod<TArgs, TResult>> {
		const originalMethod = descriptor.value;
		if (originalMethod === undefined) {
			throw new TypeError(`TrackAuthFlow can only decorate async methods (${String(propertyKey)})`);
		}

		descriptor.value = async function (this: AuthFlowHost, ...args: TArgs): Promise<TResult> {
			const authEvents = this.authEvents;
			if (authEvents === undefined) {
				throw new AuthFlowTrackingError(`@TrackAuthFlow("${flow}") on ${String(propertyKey)}: the host must inject authEvents: AuthEventsService`);
			}

			const flowStartedAt: number = performance.now();
			const subject = new AuthFlowSubject();

			const recordEvent = async (status: AuthFlowEvent["status"], error: ApiErrorCode | null): Promise<void> => {
				const resolvedClientType = clientTypeExtractor !== undefined ? (clientTypeExtractor(...args) ?? null) : null;

				// Awaited (never fire-and-forget); `recordFlow` never throws, so a
				// telemetry write failure cannot replace the flow's own outcome.
				await authEvents.recordFlow(
					AuthFlowEventSchema.parse({
						flow,
						userId: subject.identifiedUserId,
						clientType: resolvedClientType,
						status,
						error,
						durationMs: Math.round(performance.now() - flowStartedAt),
					}),
				);
			};

			try {
				const result: TResult = await authFlowSubjectScope.run(subject, async (): Promise<TResult> => originalMethod.apply(this, args));
				await recordEvent("succeeded", null);
				return result;
			} catch (caught) {
				const caughtValue = CaughtValueSchema.safeParse(caught);
				await recordEvent("failed", caughtValue.success ? authFlowErrorCode(caughtValue.data) : UNRECOGNIZED_ERROR_CODE);
				throw caught;
			}
		};

		return descriptor;
	};
}
