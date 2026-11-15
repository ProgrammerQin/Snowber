// Shared, isomorphic domain constants. These mirror the Prisma enums so that
// client components never need to import the generated Prisma client.

export const ROLES = ["HOMEOWNER", "CLEANER", "CONTROLLER"] as const;
export type Role = (typeof ROLES)[number];

export const LOT_SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
export type LotSize = (typeof LOT_SIZES)[number];

export const JOB_STATUSES = [
  "REQUESTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CONFIRMED",
  "DISPUTED",
  "CANCELLED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const PHOTO_KINDS = ["BEFORE", "AFTER"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const TOOL_TYPES = ["SHOVEL", "SNOW_BLOWER", "SALT_SPREADER", "ICE_CHOPPER"] as const;
export type ToolType = (typeof TOOL_TYPES)[number];

export const TOOL_STATUSES = ["AVAILABLE", "MAINTENANCE", "RETIRED"] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

export const RENTAL_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "RETURNED", "CANCELLED"] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  HOMEOWNER: "Homeowner",
  CLEANER: "Cleaner",
  CONTROLLER: "Controller",
};

export const ROLE_HOME: Record<Role, string> = {
  HOMEOWNER: "/homeowner",
  CLEANER: "/cleaner",
  CONTROLLER: "/controller",
};

export const LOT_SIZE_LABEL: Record<LotSize, string> = {
  SMALL: "Small (1-car driveway)",
  MEDIUM: "Medium (2-car driveway)",
  LARGE: "Large (3+ cars or long driveway)",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  REQUESTED: "Requested",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  DISPUTED: "Disputed",
  CANCELLED: "Cancelled",
};

export const TOOL_TYPE_LABEL: Record<ToolType, string> = {
  SHOVEL: "Shovel",
  SNOW_BLOWER: "Snow blower",
  SALT_SPREADER: "Salt spreader",
  ICE_CHOPPER: "Ice chopper",
};

export const RENTAL_STATUS_LABEL: Record<RentalStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
