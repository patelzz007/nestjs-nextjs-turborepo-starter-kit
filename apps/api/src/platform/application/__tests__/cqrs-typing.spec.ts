import { Command, type CommandResult } from "@nestjs/cqrs";
import { describe, expectTypeOf, it } from "vitest";

type PingResult = "pong";

class PingCommand extends Command<PingResult> {}

/**
 * Documents @nestjs/cqrs generics for juniors: `Command<TResult>` flows through
 * `CommandResult<PingCommand>` and `ICommandHandler<PingCommand>` so `CommandBus.execute()`
 * infers `PingResult` without casts.
 */
describe("@nestjs/cqrs typing", () => {
	it("infers CommandBus.execute() result from Command<TResult>", () => {
		expectTypeOf<CommandResult<PingCommand>>().toEqualTypeOf<PingResult>();
	});
});
