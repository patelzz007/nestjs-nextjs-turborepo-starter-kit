import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/** POST bodies with no fields (issue a pairing code, revoke a key): documents the optional empty body. */
export class PosEmptyBodyDto extends createZodDto(z.object({}).strict()) {}
