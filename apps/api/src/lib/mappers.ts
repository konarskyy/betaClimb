import type { PublicUser } from "@betaclimb/shared";
import type { Role, User } from "@prisma/client";

export function toPublicUser(u: {
  id: string;
  username: string;
  heightCm: number;
  role: Role;
}): PublicUser {
  return {
    id: u.id,
    username: u.username,
    heightCm: u.heightCm,
    role: u.role as PublicUser["role"],
  };
}

export type { User };
