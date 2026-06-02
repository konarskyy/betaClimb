import type { AuthResponse } from "@betaclimb/shared";
import { loginSchema, refreshSchema, registerSchema } from "@betaclimb/shared";
import type { FastifyInstance } from "fastify";
import { issueTokens, verifyRefresh } from "../auth/jwt.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { parseBody } from "../lib/http.js";
import { toPublicUser } from "../lib/mappers.js";
import { prisma } from "../prisma.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Rejestracja
  app.post("/auth/register", async (req, reply) => {
    const body = parseBody(reply, registerSchema, req.body);
    if (!body) return;

    const exists = await prisma.user.findUnique({ where: { username: body.username } });
    if (exists) {
      return reply.code(409).send({ error: "Użytkownik o tym loginie już istnieje" });
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { username: body.username, passwordHash, heightCm: body.heightCm },
    });

    const tokens = issueTokens({ sub: user.id, role: user.role });
    const res: AuthResponse = { user: toPublicUser(user), tokens };
    return reply.code(201).send(res);
  });

  // Logowanie
  app.post("/auth/login", async (req, reply) => {
    const body = parseBody(reply, loginSchema, req.body);
    if (!body) return;

    const user = await prisma.user.findUnique({ where: { username: body.username } });
    // Ten sam komunikat dla nieistniejącego użytkownika i złego hasła —
    // nie zdradzamy, który warunek zawiódł.
    const ok = user ? await verifyPassword(user.passwordHash, body.password) : false;
    if (!user || !ok) {
      return reply.code(401).send({ error: "Nieprawidłowy login lub hasło" });
    }

    const tokens = issueTokens({ sub: user.id, role: user.role });
    const res: AuthResponse = { user: toPublicUser(user), tokens };
    return reply.send(res);
  });

  // Odświeżenie tokenów
  app.post("/auth/refresh", async (req, reply) => {
    const body = parseBody(reply, refreshSchema, req.body);
    if (!body) return;

    let sub: string;
    try {
      sub = verifyRefresh(body.refreshToken).sub;
    } catch {
      return reply.code(401).send({ error: "Nieprawidłowy lub wygasły token odświeżania" });
    }

    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) {
      return reply.code(401).send({ error: "Nieprawidłowy lub wygasły token odświeżania" });
    }

    const tokens = issueTokens({ sub: user.id, role: user.role });
    const res: AuthResponse = { user: toPublicUser(user), tokens };
    return reply.send(res);
  });
}
