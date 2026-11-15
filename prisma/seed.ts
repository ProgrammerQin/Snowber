/**
 * Storm-morning demo data for one fictional neighborhood ("Maple Hollow"):
 * 40 homes, 8 cleaners, 6 tools, service windows for tomorrow's storm, and jobs in
 * every state (with generated before/after photos run through the real pipeline).
 *
 *   npm run db:seed        (or: npx prisma db seed)
 *
 * Every account's password is "snowber-demo".
 * The seed wipes existing data first; never run it against a production database.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type JobStatus, type LotSize } from "../src/generated/prisma/client";
import { NEIGHBORHOOD_CENTER } from "../src/lib/config";
import { processPhoto, renderComparison } from "../src/lib/images";
import { suggestAssignments } from "../src/lib/matching";
import { cleanerPayout, quoteForWindows } from "../src/lib/pricing";
import { getStorage, storageKeys } from "../src/lib/storage";
import { addCalendarDays, zonedCalendarDate, zonedTimeToUtc } from "../src/lib/time";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const storage = getStorage();
const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Toronto";
const PASSWORD = "snowber-demo";
const HOUR = 60 * 60 * 1000;

// Deterministic pseudo-random numbers so every seed run looks the same.
let state = 20261106;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];

const now = new Date();
const today = zonedCalendarDate(now, TZ);
const at = (daysAhead: number, hour: number, minute = 0) =>
  zonedTimeToUtc({ ...addCalendarDays(today, daysAhead), hour, minute }, TZ);

async function createUser(input: { name: string; email: string; role: "HOMEOWNER" | "CLEANER" | "CONTROLLER"; extra?: object }) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      name: input.name,
      email: input.email,
      emailVerified: true,
      role: input.role,
      ...input.extra,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(PASSWORD) } },
    },
  });
}

// ───────────────── placeholder photos ─────────────────

function photoSvg(kind: "BEFORE" | "AFTER", seed: number) {
  const hue = 200 + (seed % 30);
  const drive =
    kind === "BEFORE"
      ? `<rect x="330" y="470" width="560" height="430" fill="#f4f7fb"/>
         ${Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 97 + seed * 13) % 1200}" cy="${(i * 53 + seed * 7) % 900}" r="${2 + (i % 4)}" fill="#ffffff" opacity="0.9"/>`).join("")}`
      : `<rect x="330" y="470" width="560" height="430" fill="#3b4048"/>
         <rect x="300" y="470" width="30" height="430" fill="#eef2f7"/><rect x="890" y="470" width="30" height="430" fill="#eef2f7"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <rect width="1200" height="900" fill="hsl(${hue},35%,${kind === "BEFORE" ? 82 : 70}%)"/>
    <rect y="430" width="1200" height="470" fill="${kind === "BEFORE" ? "#e9eef5" : "#dfe6ee"}"/>
    <polygon points="380,250 610,90 840,250" fill="#7a3e2e"/>
    <rect x="410" y="250" width="400" height="220" fill="hsl(${(seed * 47) % 360},25%,60%)"/>
    <rect x="575" y="330" width="70" height="140" fill="#3a2a20"/>
    <rect x="450" y="300" width="80" height="60" fill="#cfe3f3"/><rect x="690" y="300" width="80" height="60" fill="#cfe3f3"/>
    ${drive}
  </svg>`);
}

async function storePhoto(jobId: string, kind: "BEFORE" | "AFTER", seed: number, uploadedById: string, createdAt: Date, flag?: string) {
  const jpeg = await sharp(photoSvg(kind, seed)).jpeg({ quality: 85 }).toBuffer();
  const processed = await processPhoto(jpeg);
  const photoId = randomUUID().replace(/-/g, "");
  const displayKey = storageKeys.photoDisplay(jobId, photoId);
  const thumbKey = storageKeys.photoThumb(jobId, photoId);
  await storage.putObject(displayKey, processed.display, "image/webp");
  await storage.putObject(thumbKey, processed.thumb, "image/webp");
  return prisma.jobPhoto.create({
    data: {
      id: photoId,
      jobId,
      kind,
      displayKey,
      thumbKey,
      width: processed.width,
      height: processed.height,
      takenAt: flag ? new Date(createdAt.getTime() - 72 * HOUR) : createdAt,
      flagged: Boolean(flag),
      flagReason: flag ?? null,
      uploadedById,
      createdAt,
    },
  });
}

async function storeComparison(jobId: string, address: string, before: { displayKey: string; createdAt: Date }, after: { displayKey: string; createdAt: Date }) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit" });
  const image = await renderComparison(await storage.getObject(before.displayKey), await storage.getObject(after.displayKey), {
    title: `Snowber · ${address}`,
    before: `BEFORE · ${fmt.format(before.createdAt)}`,
    after: `AFTER · ${fmt.format(after.createdAt)}`,
  });
  const key = storageKeys.comparison(jobId);
  await storage.putObject(key, image, "image/jpeg");
  return key;
}

// ───────────────── main ─────────────────

async function main() {
  console.log("Resetting data…");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "LedgerEntry","Payment","Review","JobPhoto","_JobWindowOptions","Job","ToolRental","Tool","Shift","ServiceWindow","Property","Session","Account","Verification","User" RESTART IDENTITY CASCADE`,
  );
  if (storage.driver === "local") await rm(path.resolve(process.env.LOCAL_STORAGE_DIR || ".storage"), { recursive: true, force: true });

  console.log("Creating accounts…");
  const controller = await createUser({ name: "Morgan Lee", email: "controller@snowber.test", role: "CONTROLLER" });

  // Maple Hollow: five streets around the neighborhood center.
  const streets = [
    { name: "Maple Crescent", lat: 0.0022, lng: -0.004, dLat: 0, dLng: 0.00045 },
    { name: "Birch Avenue", lat: 0.0008, lng: -0.004, dLat: 0, dLng: 0.00045 },
    { name: "Cedar Lane", lat: -0.0006, lng: -0.004, dLat: 0, dLng: 0.00045 },
    { name: "Willow Street", lat: -0.002, lng: -0.004, dLat: 0, dLng: 0.00045 },
    { name: "Juniper Road", lat: -0.0026, lng: 0.0006, dLat: 0.0006, dLng: 0 },
  ];
  const homeAt = (street: number, index: number) => ({
    lat: NEIGHBORHOOD_CENTER.lat + streets[street].lat + streets[street].dLat * index + (rand() - 0.5) * 0.00008,
    lng: NEIGHBORHOOD_CENTER.lng + streets[street].lng + streets[street].dLng * index + (rand() - 0.5) * 0.00008,
  });

  const cleanerSpecs = [
    { name: "Ava Chen", email: "ava.cleaner@snowber.test", street: 0, index: 2, ownsBlower: false },
    { name: "Ben Okafor", email: "ben.cleaner@snowber.test", street: 2, index: 15, ownsBlower: true },
    { name: "Chloe Martin", email: "chloe.cleaner@snowber.test", street: 1, index: 9, ownsBlower: false },
    { name: "Diego Ramirez", email: "diego.cleaner@snowber.test", street: 3, index: 4, ownsBlower: true },
    { name: "Emma Wilson", email: "emma.cleaner@snowber.test", street: 4, index: 3, ownsBlower: false },
    { name: "Farah Haddad", email: "farah.cleaner@snowber.test", street: 3, index: 13, ownsBlower: false },
    { name: "Gus Novak", email: "gus.cleaner@snowber.test", street: 0, index: 12, ownsBlower: false },
    { name: "Hana Sato", email: "hana.cleaner@snowber.test", street: 1, index: 1, ownsBlower: false },
  ];
  const cleaners: Awaited<ReturnType<typeof createUser>>[] = [];
  for (const spec of cleanerSpecs) {
    const home = homeAt(spec.street, spec.index);
    cleaners.push(
      await createUser({
        name: spec.name,
        email: spec.email,
        role: "CLEANER",
        extra: {
          homeAddress: `${spec.index * 2 + 3} ${streets[spec.street].name}, Toronto, ON`,
          homeLat: home.lat,
          homeLng: home.lng,
          ownsBlower: spec.ownsBlower,
          phone: `416-555-01${String(cleaners.length).padStart(2, "0")}`,
        },
      }),
    );
  }
  const [ava, ben, chloe, diego, emma, farah, gus, hana] = cleaners;

  const firstNames = ["Grace", "Henry", "Isla", "Jamal", "Kiko", "Liam", "Maya", "Noah", "Olivia", "Priya", "Quinn", "Rosa", "Sam", "Tara", "Umar", "Vera", "Will", "Xin", "Yara", "Zoe", "Arjun", "Bea", "Carlos", "Dana", "Eli"];
  const lastNames = ["Kim", "Brown", "Singh", "Tremblay", "Roy", "Gagnon", "Wong", "Patel", "Lee", "Martin", "Nguyen", "Fraser", "Cohen", "Ali", "Rossi"];
  const homeowners: Awaited<ReturnType<typeof createUser>>[] = [];
  for (let i = 0; i < firstNames.length; i++) {
    const name = `${firstNames[i]} ${i === 0 ? "Kim" : lastNames[i % lastNames.length]}`;
    const email = i === 0 ? "grace.home@snowber.test" : `${firstNames[i].toLowerCase()}.home@snowber.test`;
    homeowners.push(await createUser({ name, email, role: "HOMEOWNER" }));
  }

  console.log("Creating 40 properties…");
  const lotCycle: LotSize[] = ["SMALL", "MEDIUM", "SMALL", "MEDIUM", "LARGE", "MEDIUM", "SMALL", "MEDIUM", "SMALL", "LARGE"];
  const notes = [null, null, "Please pile snow on the left side.", "Watch the icy front steps.", null, "Gate code 4512.", null, "Car leaves at 7:30 — driveway first please."];
  const properties: Awaited<ReturnType<typeof prisma.property.create>>[] = [];
  for (let i = 0; i < 40; i++) {
    const street = i % 5;
    const index = Math.floor(i / 5) * 2 + (street % 2);
    const owner = i < 25 ? homeowners[i] : homeowners[(i - 25) % 6]; // Grace and a few others own two properties
    const position = homeAt(street, index);
    properties.push(
      await prisma.property.create({
        data: {
          ownerId: owner.id,
          label: owner.id === homeowners[0].id ? (i === 0 ? "Home" : "Mom's place") : null,
          address: `${index * 2 + 10} ${streets[street].name}, Toronto, ON`,
          lat: position.lat,
          lng: position.lng,
          lotSize: lotCycle[i % lotCycle.length],
          hasSidewalk: i % 7 !== 3,
          notes: pick(notes),
        },
      }),
    );
  }

  console.log("Creating service windows and shifts…");
  const recentStart = new Date(Math.floor((now.getTime() - 3 * HOUR) / HOUR) * HOUR);
  const windows = {
    yesterday: await prisma.serviceWindow.create({ data: { startsAt: at(-1, 7), endsAt: at(-1, 9), multiplierBps: 12500, status: "CLOSED", createdById: controller.id } }),
    recent: await prisma.serviceWindow.create({ data: { startsAt: recentStart, endsAt: new Date(recentStart.getTime() + 2 * HOUR), multiplierBps: 10000, status: "CLOSED", createdById: controller.id } }),
    early: await prisma.serviceWindow.create({ data: { label: "Early birds", startsAt: at(1, 6), endsAt: at(1, 8), multiplierBps: 15000, createdById: controller.id } }),
    mid: await prisma.serviceWindow.create({ data: { startsAt: at(1, 8), endsAt: at(1, 10), multiplierBps: 12500, createdById: controller.id } }),
    late: await prisma.serviceWindow.create({ data: { startsAt: at(1, 10), endsAt: at(1, 12), multiplierBps: 10000, createdById: controller.id } }),
    nextDay: await prisma.serviceWindow.create({ data: { startsAt: at(2, 7), endsAt: at(2, 9), multiplierBps: 10000, createdById: controller.id } }),
  };

  const shiftPlan: [typeof ava, number, number][] = [
    [ava, 6, 10],
    [ben, 6, 12],
    [chloe, 8, 12],
    [diego, 6, 9],
    [emma, 9, 12],
    [farah, 6, 8],
    [gus, 7, 11],
    [hana, 10, 12],
  ];
  for (const [cleaner, from, to] of shiftPlan) {
    await prisma.shift.create({ data: { cleanerId: cleaner.id, startsAt: at(1, from), endsAt: at(1, to) } });
  }
  await prisma.shift.create({ data: { cleanerId: ava.id, startsAt: at(-1, 6), endsAt: at(-1, 10) } });
  await prisma.shift.create({ data: { cleanerId: ben.id, startsAt: at(-1, 6), endsAt: at(-1, 10) } });
  await prisma.shift.create({ data: { cleanerId: ava.id, startsAt: new Date(recentStart.getTime() - HOUR), endsAt: new Date(recentStart.getTime() + 3 * HOUR) } });
  await prisma.shift.create({ data: { cleanerId: ben.id, startsAt: new Date(recentStart.getTime() - HOUR), endsAt: new Date(recentStart.getTime() + 3 * HOUR) } });

  console.log("Stocking the tool library…");
  const blower1 = await prisma.tool.create({ data: { name: "Blower #1", type: "SNOW_BLOWER", feeCents: 2000, notes: "24-inch two-stage" } });
  const blower2 = await prisma.tool.create({ data: { name: "Blower #2", type: "SNOW_BLOWER", feeCents: 2000 } });
  await prisma.tool.create({ data: { name: "Blower #3", type: "SNOW_BLOWER", feeCents: 2000, status: "MAINTENANCE", notes: "Auger shear pin replacement" } });
  await prisma.tool.create({ data: { name: "Salt spreader", type: "SALT_SPREADER", feeCents: 800 } });
  await prisma.tool.create({ data: { name: "Shovel kit A", type: "SHOVEL", feeCents: 300, notes: "Ergonomic shovel + pusher" } });
  await prisma.tool.create({ data: { name: "Ice chopper", type: "ICE_CHOPPER", feeCents: 500 } });

  const avaRental = await prisma.toolRental.create({
    data: { toolId: blower1.id, cleanerId: ava.id, startsAt: at(1, 6), endsAt: at(1, 10), status: "APPROVED", feeCents: 2000, decidedAt: now },
  });
  await prisma.ledgerEntry.create({ data: { cleanerId: ava.id, type: "RENTAL_FEE", amountCents: -2000, rentalId: avaRental.id, description: "Blower #1 rental" } });
  await prisma.toolRental.create({ data: { toolId: blower2.id, cleanerId: chloe.id, startsAt: at(1, 8), endsAt: at(1, 12), feeCents: 2000 } });

  console.log("Booking jobs…");
  type W = keyof typeof windows;
  async function book(propertyIndex: number, options: W[], extra: { tipCents?: number; includeSalt?: boolean; createdAt?: Date } = {}) {
    const property = properties[propertyIndex];
    const opts = options.map((k) => windows[k]);
    const q = quoteForWindows({ lotSize: property.lotSize, includeSidewalk: property.hasSidewalk, includeSalt: extra.includeSalt ?? false }, opts.map((w) => w.multiplierBps));
    const tipCents = extra.tipCents ?? 0;
    return prisma.job.create({
      data: {
        propertyId: property.id,
        homeownerId: property.ownerId,
        includeSidewalk: property.hasSidewalk,
        includeSalt: extra.includeSalt ?? false,
        priceCents: q.totalCents,
        tipCents,
        estMinutes: q.estMinutes,
        requiresBlower: q.requiresBlower,
        createdAt: extra.createdAt ?? new Date(now.getTime() - (40 - propertyIndex) * 7 * 60 * 1000),
        windowOptions: { connect: opts.map((w) => ({ id: w.id })) },
        payment: { create: { provider: "mock", externalId: `mock_ch_seed_${propertyIndex}`, amountCents: q.totalCents + tipCents } },
      },
      include: { property: true },
    });
  }

  async function advance(
    job: Awaited<ReturnType<typeof book>>,
    cleanerId: string,
    windowKey: W,
    status: JobStatus,
    when: { assigned: Date; started?: Date; completed?: Date; confirmed?: Date },
  ) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status,
        cleanerId,
        assignedWindowId: windows[windowKey].id,
        assignedAt: when.assigned,
        startedAt: when.started,
        completedAt: when.completed,
        confirmedAt: when.confirmed,
        disputeReason: status === "DISPUTED" ? "The sidewalk was still icy and the end of the driveway wasn't cleared." : null,
      },
    });
    const photoSeed = properties.findIndex((p) => p.id === job.propertyId) + 1;
    const before = when.started ? await storePhoto(job.id, "BEFORE", photoSeed, cleanerId, when.started) : null;
    if (before && when.completed) {
      const after = await storePhoto(
        job.id,
        "AFTER",
        photoSeed,
        cleanerId,
        when.completed,
        status === "DISPUTED" ? "Camera says this photo was taken 3 days before the window." : undefined,
      );
      const comparisonKey = await storeComparison(job.id, job.property.address, before, after);
      await prisma.job.update({ where: { id: job.id }, data: { comparisonKey } });
    }
    if (status === "CONFIRMED") {
      await prisma.ledgerEntry.create({
        data: { cleanerId, type: "EARNING", amountCents: cleanerPayout(job.priceCents) + job.tipCents, jobId: job.id, description: job.property.address, createdAt: when.confirmed },
      });
    }
  }

  // Yesterday: finished history for Ava and Ben.
  const y = (h: number, m = 0) => at(-1, h, m);
  const history = [
    { p: 5, c: ava, st: "CONFIRMED" as const, tip: 500 },
    { p: 10, c: ava, st: "CONFIRMED" as const },
    { p: 15, c: ben, st: "CONFIRMED" as const },
    { p: 20, c: ben, st: "CONFIRMED" as const, tip: 1000 },
    { p: 25, c: ben, st: "DISPUTED" as const },
  ];
  for (const [i, h] of history.entries()) {
    const job = await book(h.p, ["yesterday"], { tipCents: h.tip, createdAt: at(-2, 18, i * 5) });
    await advance(job, h.c.id, "yesterday", h.st, {
      assigned: at(-2, 20),
      started: y(7, i * 15),
      completed: y(7, i * 15 + 25),
      confirmed: h.st === "CONFIRMED" ? y(10, i * 10) : undefined,
    });
    await prisma.job.update({ where: { id: job.id }, data: { routeOrder: (i % 3) + 1 } });
  }
  // Two-way reviews on the confirmed history.
  const confirmed = await prisma.job.findMany({ where: { status: "CONFIRMED" }, select: { id: true, cleanerId: true, homeownerId: true } });
  for (const [i, job] of confirmed.entries()) {
    await prisma.review.create({ data: { jobId: job.id, authorId: job.homeownerId, subjectId: job.cleanerId!, rating: [5, 5, 4, 5][i % 4], comment: ["Spotless, even the sidewalk!", "Quick and friendly.", "Good job, missed a corner.", null][i % 4] } });
    if (i % 2 === 0) await prisma.review.create({ data: { jobId: job.id, authorId: job.cleanerId!, subjectId: job.homeownerId, rating: 5, comment: "Accurate size, easy access." } });
  }

  // Earlier today: one job waiting for Grace to confirm, one still in progress.
  const graceDone = await book(0, ["recent"], { tipCents: 500, createdAt: new Date(recentStart.getTime() - 10 * HOUR) });
  await advance(graceDone, ava.id, "recent", "COMPLETED", {
    assigned: new Date(recentStart.getTime() - 8 * HOUR),
    started: new Date(recentStart.getTime() + 20 * 60 * 1000),
    completed: new Date(Math.min(now.getTime() - 30 * 60 * 1000, recentStart.getTime() + 55 * 60 * 1000)),
  });
  await prisma.job.update({ where: { id: graceDone.id }, data: { routeOrder: 1 } });
  const benWorking = await book(12, ["recent"], { createdAt: new Date(recentStart.getTime() - 9 * HOUR) });
  await advance(benWorking, ben.id, "recent", "IN_PROGRESS", {
    assigned: new Date(recentStart.getTime() - 8 * HOUR),
    started: new Date(now.getTime() - 15 * 60 * 1000),
  });
  await prisma.job.update({ where: { id: benWorking.id }, data: { routeOrder: 1 } });

  // Tomorrow's storm: a surge of requests across the three windows.
  const optionSets: W[][] = [["early"], ["early", "mid"], ["mid"], ["mid", "late"], ["late"], ["early", "mid", "late"]];
  for (let i = 1; i < 40; i++) {
    if ([5, 10, 15, 20, 25, 12].includes(i) || i % 9 === 8) continue; // history above, and some homes didn't book
    await book(i, optionSets[i % optionSets.length], { tipCents: i % 4 === 0 ? 500 : 0, includeSalt: i % 6 === 0 });
  }
  // Grace's own home also books an early slot.
  await book(0, ["early", "mid"], { tipCents: 500 });

  // The controller already placed the oldest early requests with Ava (rented blower) and
  // Ben (owns one), using the same matching heuristic as the dispatch board, so their
  // routes fit inside the 2-hour window. The rest are left for the "Suggest" demo.
  const earlyJobs = await prisma.job.findMany({
    where: { status: "REQUESTED", windowOptions: { some: { id: windows.early.id } } },
    include: { property: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  const match = suggestAssignments(
    earlyJobs.map((j) => ({ id: j.id, lat: j.property.lat, lng: j.property.lng, estMinutes: j.estMinutes, requiresBlower: j.requiresBlower, createdAt: j.createdAt })),
    [ava, ben].map((c) => ({ id: c.id, start: { lat: c.homeLat!, lng: c.homeLng! }, capacityMinutes: 120, hasBlower: true })),
  );
  for (const [cleanerId, route] of Object.entries(match.routes)) {
    for (const [order, jobId] of route.entries()) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "ASSIGNED", cleanerId, assignedWindowId: windows.early.id, assignedAt: now, routeOrder: order + 1 },
      });
    }
  }

  const counts = await prisma.job.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("Jobs by status:", Object.fromEntries(counts.map((c) => [c.status, c._count._all])));
  console.log(`\nSeeded ${homeowners.length} homeowners, ${cleaners.length} cleaners, ${properties.length} properties.`);
  console.log(`Sign in with any demo account, password "${PASSWORD}":`);
  console.log("  controller@snowber.test · ava.cleaner@snowber.test · ben.cleaner@snowber.test · grace.home@snowber.test");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
