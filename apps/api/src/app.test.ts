import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { prisma } from "./prisma.js";

/**
 * Test integracyjny — wymaga uruchomionej bazy PostgreSQL (npm run db:up)
 * z wypchniętym schematem (npm run db:push --workspace apps/api).
 */
let app: FastifyInstance;
const username = `tester_${Date.now()}`;
const password = "tajneHaslo123";

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username } });
  await app.close();
  await prisma.$disconnect();
});

describe("przepływ auth → trasa → beta", () => {
  let accessToken = "";
  let routeId = "";

  it("rejestruje użytkownika z wzrostem", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username, password, heightCm: 180 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.username).toBe(username);
    expect(body.user.heightCm).toBe(180);
    expect(body.tokens.accessToken).toBeTruthy();
    accessToken = body.tokens.accessToken;
  });

  it("odrzuca logowanie ze złym hasłem (ten sam komunikat)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username, password: "zleHaslo123" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatch(/login lub hasło/i);
  });

  it("blokuje /me bez tokenu", async () => {
    const res = await app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(401);
  });

  it("zwraca profil z tokenem", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe(username);
  });

  it("tworzy trasę z chwytami", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/routes",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: "Testowa trasa",
        imgW: 1000,
        imgH: 1000,
        routeHeightM: 10,
        holds: [
          { x: 0.5, y: 0.9, isStart: true, isFinish: false },
          { x: 0.5, y: 0.8, isStart: false, isFinish: false },
          { x: 0.5, y: 0.7, isStart: false, isFinish: false },
          { x: 0.5, y: 0.6, isStart: false, isFinish: false },
          { x: 0.5, y: 0.5, isStart: false, isFinish: true },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    routeId = res.json().id;
    expect(routeId).toBeTruthy();
  });

  it("wyznacza betę na 3 poziomach", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/routes/${routeId}/beta`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.heightCm).toBe(180);
    for (const level of ["static", "dynamic", "flash"] as const) {
      expect(body.betas[level].feasible).toBe(true);
    }
  });

  it("uwzględnia nadpisany wzrost w wyniku bety", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/routes/${routeId}/beta`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { heightCm: 200 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().betas.static.maxReachCm).toBe(Math.round(200 * 0.65));
  });
});
