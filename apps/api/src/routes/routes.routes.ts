import type { BetaLevel, BetaResult } from "@betaclimb/shared";
import { betaQuerySchema, createRouteSchema } from "@betaclimb/shared";
import { computeAllBetas } from "@betaclimb/beta-engine";
import type { FastifyInstance } from "fastify";
import { parseBody } from "../lib/http.js";
import { prisma } from "../prisma.js";
import { isAllowedMime, saveImage } from "../storage.js";

export async function routeRoutes(app: FastifyInstance): Promise<void> {
  // Utworzenie trasy wraz z chwytami
  app.post("/routes", { preHandler: app.authenticate }, async (req, reply) => {
    const body = parseBody(reply, createRouteSchema, req.body);
    if (!body) return;

    const route = await prisma.route.create({
      data: {
        userId: req.user!.sub,
        name: body.name,
        imgW: body.imgW,
        imgH: body.imgH,
        routeHeightM: body.routeHeightM,
        holds: {
          create: body.holds.map((h) => ({
            x: h.x,
            y: h.y,
            isStart: h.isStart,
            isFinish: h.isFinish,
          })),
        },
      },
      include: { holds: true },
    });
    return reply.code(201).send(route);
  });

  // Lista tras użytkownika
  app.get("/routes", { preHandler: app.authenticate }, async (req, reply) => {
    const routes = await prisma.route.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { holds: true } } },
    });
    return reply.send(routes);
  });

  // Szczegóły trasy
  app.get<{ Params: { id: string } }>(
    "/routes/:id",
    { preHandler: app.authenticate },
    async (req, reply) => {
      const route = await prisma.route.findFirst({
        where: { id: req.params.id, userId: req.user!.sub },
        include: { holds: true },
      });
      if (!route) return reply.code(404).send({ error: "Nie znaleziono trasy" });
      return reply.send(route);
    },
  );

  // Upload zdjęcia trasy (multipart)
  app.post<{ Params: { id: string } }>(
    "/routes/:id/image",
    { preHandler: app.authenticate },
    async (req, reply) => {
      const route = await prisma.route.findFirst({
        where: { id: req.params.id, userId: req.user!.sub },
      });
      if (!route) return reply.code(404).send({ error: "Nie znaleziono trasy" });

      const file = await req.file();
      if (!file) return reply.code(400).send({ error: "Brak pliku" });
      if (!isAllowedMime(file.mimetype)) {
        return reply.code(415).send({ error: "Nieobsługiwany format (dozwolone: JPG, PNG, WEBP)" });
      }

      const buffer = await file.toBuffer();
      const imageUrl = await saveImage(buffer, file.mimetype);
      const updated = await prisma.route.update({
        where: { id: route.id },
        data: { imageUrl },
      });
      return reply.send(updated);
    },
  );

  // Wyznaczenie bety dla trasy (3 poziomy), spersonalizowane wzrostem
  app.post<{ Params: { id: string } }>(
    "/routes/:id/beta",
    { preHandler: app.authenticate },
    async (req, reply) => {
      const query = parseBody(reply, betaQuerySchema, req.body ?? {});
      if (!query) return;

      const route = await prisma.route.findFirst({
        where: { id: req.params.id, userId: req.user!.sub },
        include: { holds: true },
      });
      if (!route) return reply.code(404).send({ error: "Nie znaleziono trasy" });

      const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
      if (!user) return reply.code(404).send({ error: "Nie znaleziono użytkownika" });

      const heightCm = query.heightCm ?? user.heightCm;
      const levels: readonly BetaLevel[] | undefined = query.levels;

      const betas = computeAllBetas(
        route.holds.map((h) => ({
          id: h.id,
          x: h.x,
          y: h.y,
          isStart: h.isStart,
          isFinish: h.isFinish,
        })),
        { imgW: route.imgW, imgH: route.imgH, routeHeightM: route.routeHeightM },
        { heightCm },
        levels,
      );

      return reply.send({
        routeId: route.id,
        heightCm,
        betas: betas as Record<BetaLevel, BetaResult>,
      });
    },
  );
}
