import type { FastifyReply } from "fastify";
import type { z } from "zod";

/** Waliduje dane wejściowe schematem Zod; przy błędzie odsyła 400 i zwraca null. */
export function parseBody<T>(
  reply: FastifyReply,
  schema: z.ZodType<T>,
  data: unknown,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    reply.code(400).send({
      error: "Nieprawidłowe dane wejściowe",
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return null;
  }
  return result.data;
}
