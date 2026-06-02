import { mkdir } from "node:fs/promises";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { verifyAccess } from "./auth/jwt.js";
import { authRoutes } from "./routes/auth.routes.js";
import { meRoutes } from "./routes/me.routes.js";
import { routeRoutes } from "./routes/routes.routes.js";
import { storageRoot } from "./storage.js";
import "./types.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024 } }); // 15 MB

  // Serwowanie wgranych zdjęć (dev): /uploads/<plik>
  await mkdir(storageRoot, { recursive: true });
  await app.register(fastifyStatic, {
    root: storageRoot,
    prefix: "/uploads/",
    decorateReply: false,
  });

  // preHandler autoryzacji: weryfikuje token dostępu z nagłówka Authorization
  app.decorate("authenticate", async (req, reply) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Brak autoryzacji" });
    }
    try {
      req.user = verifyAccess(header.slice("Bearer ".length));
    } catch {
      return reply.code(401).send({ error: "Nieprawidłowy lub wygasły token" });
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(routeRoutes);

  return app;
}
