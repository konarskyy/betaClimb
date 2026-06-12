import { updateProfileSchema } from "@betaclimb/shared";
import type { FastifyInstance } from "fastify";
import { parseBody } from "../lib/http.js";
import { toPublicUser } from "../lib/mappers.js";
import { prisma } from "../prisma.js";
import { isAllowedMime, saveImage } from "../storage.js";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  // Dane zalogowanego użytkownika
  app.get("/me", { preHandler: app.authenticate }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return reply.code(404).send({ error: "Nie znaleziono użytkownika" });
    return reply.send(toPublicUser(user));
  });

  // Aktualizacja profilu (wzrost)
  app.patch("/me", { preHandler: app.authenticate }, async (req, reply) => {
    const body = parseBody(reply, updateProfileSchema, req.body);
    if (!body) return;
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { heightCm: body.heightCm },
    });
    return reply.send(toPublicUser(user));
  });

  // Upload zdjęcia profilowego (multipart)
  app.post("/me/avatar", { preHandler: app.authenticate }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Brak pliku" });
    if (!isAllowedMime(file.mimetype)) {
      return reply.code(415).send({ error: "Nieobsługiwany format (dozwolone: JPG, PNG, WEBP)" });
    }
    const buffer = await file.toBuffer();
    const avatarUrl = await saveImage(buffer, file.mimetype);
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { avatarUrl },
    });
    return reply.send(toPublicUser(user));
  });
}
