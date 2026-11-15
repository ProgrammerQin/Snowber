import "server-only";
import { prisma } from "@/lib/prisma";
import type { LotSize } from "@/lib/contracts/domain";
import { geocodeAddress } from "@/lib/geocode";
import { assertRole, type CurrentUser } from "./session";

export async function listMyProperties(user: CurrentUser) {
  assertRole(user, "HOMEOWNER");
  return prisma.property.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } });
}

/** Geocodes the address once and stores the coordinates with the property. */
export async function createProperty(
  user: CurrentUser,
  input: { label?: string; address: string; lotSize: LotSize; hasSidewalk: boolean; notes?: string },
) {
  assertRole(user, "HOMEOWNER");
  const position = await geocodeAddress(input.address);
  return prisma.property.create({
    data: {
      ownerId: user.id,
      label: input.label,
      address: input.address,
      lat: position.lat,
      lng: position.lng,
      approximate: position.approximate,
      lotSize: input.lotSize,
      hasSidewalk: input.hasSidewalk,
      notes: input.notes,
    },
  });
}
