import type { FastifyReply, FastifyRequest } from "fastify";

/** Zawartość tokenu (claims). */
export interface JwtPayload {
  sub: string; // id użytkownika
  role: "user" | "admin";
  type: "access" | "refresh";
}

declare module "fastify" {
  interface FastifyInstance {
    /** preHandler wymagający ważnego tokenu dostępu; ustawia request.user */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    /** ustawiane przez preHandler `authenticate` */
    user?: JwtPayload;
  }
}
