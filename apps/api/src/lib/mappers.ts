import type { PublicUser } from "@betaclimb/shared";
import type { Role, User } from "@prisma/client";

export function toPublicUser(u: {
  id: string;
  username: string;
  heightCm: number;
  avatarUrl: string | null;
  role: Role;
}): PublicUser {
  return {
    id: u.id,
    username: u.username,
    heightCm: u.heightCm,
    avatarUrl: u.avatarUrl,
    role: u.role as PublicUser["role"],
  };
}

export type { User };
