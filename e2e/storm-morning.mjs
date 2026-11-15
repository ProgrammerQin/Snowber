// Scripted "storm morning" walkthrough (run it before merging and every Friday).
//
// Drives the whole product in a real browser against a running app and seeded database:
// homeowner signs up and books → controller suggests/applies assignments and drags a job →
// cleaner uploads before/after photos on a phone → homeowner sees it live, confirms and
// reviews → cleaner is credited and cashes out → database constraints and access checks.
//
// Setup (once):  npx playwright install chromium
// Run:           npm run db:seed && npm run build && npm start   (in another terminal)
//                npm run e2e
// Screenshots land in e2e/screenshots/.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, "screenshots");
const FIXTURES = path.join(HERE, "fixtures");
fs.mkdirSync(SHOTS, { recursive: true });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const one = async (query, params = []) => Object.values((await db.query(query, params)).rows[0] ?? {})[0] ?? null;

const errors = [];
const started = Date.now();
const step = (...parts) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s]`, ...parts);
function check(condition, message) {
  if (!condition) throw new Error(`Check failed: ${message}`);
}

async function newPage(browser, name, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, ...options });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && !/tile\.openstreetmap\.org/.test(m.location()?.url ?? "") && errors.push(`[${name}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${name}] ${e.message}`));
  return page;
}
// Better Auth rate-limits sign-ins (3 per 10 seconds per IP in production), and this
// script signs in several accounts quickly from one machine, so it backs off and retries.
async function signIn(page, email, password = "snowber-demo") {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto(`${BASE}/sign-in`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    const response = page.waitForResponse((r) => r.url().includes("/api/auth/sign-in"));
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    if ((await response).status() !== 429) {
      await page.waitForURL(/\/(homeowner|cleaner|controller)$/);
      return;
    }
    await page.waitForTimeout(10_500);
  }
  throw new Error(`Could not sign in as ${email} (rate limited)`);
}
const badge = (page, text) => page.locator("[data-slot=badge]").filter({ hasText: new RegExp(`^${text}$`) }).first();
/** Waits until React has hydrated an element (events fired earlier would be lost). */
async function hydrated(page, selector) {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return Boolean(el && Object.keys(el).some((key) => key.startsWith("__reactProps")));
  }, selector);
}
async function uploadPhoto(page, kind, file) {
  const selector = `[data-testid=photo-input-${kind}]`;
  await hydrated(page, selector);
  await page.setInputFiles(selector, file);
}

const browser = await chromium.launch();
try {
  // 1. Homeowner signs up, adds a property, books two windows with salt and a tip.
  const home = await newPage(browser, "homeowner");
  const email = `e2e.${Date.now()}@example.com`;
  await home.goto(`${BASE}/sign-up`);
  await home.fill("#name", "Taylor Test");
  await home.fill("#email", email);
  await home.fill("#password", "test-password-1");
  await home.getByRole("button", { name: "Create account" }).click();
  await home.waitForURL(`${BASE}/homeowner`);
  check((await one(`select role from "User" where email = $1`, [email])) === "HOMEOWNER", "new account is a homeowner");
  await home.getByRole("link", { name: "Add property" }).first().click();
  await home.fill("#address", "77 Maple Crescent, Toronto, ON");
  await home.fill("#label", "Test home");
  await home.getByRole("button", { name: "Save property" }).click();
  await home.waitForURL(/\/homeowner\/book\?property=/);
  await home.getByRole("button", { name: "Continue" }).click();
  const windowBoxes = home.locator("fieldset").filter({ hasText: "When can we come?" }).getByRole("checkbox");
  await windowBoxes.nth(0).click();
  await windowBoxes.nth(1).click();
  await home.getByLabel("Spread salt on walkways").click();
  await home.getByRole("button", { name: "Continue" }).click();
  await home.getByText("Total charged now").waitFor();
  await home.getByRole("button", { name: "$5.00" }).click();
  await home.screenshot({ path: `${SHOTS}/01-booking-review.png`, fullPage: true });
  await home.getByRole("button", { name: "Confirm booking" }).click();
  await home.waitForURL(/\/homeowner\/jobs\/.+\?booked=1/);
  const jobId = home.url().split("/jobs/")[1].split("?")[0];
  step("1 booked", jobId, "price/tip (cents):", await one(`select "priceCents"||'/'||"tipCents" from "Job" where id = $1`, [jobId]));

  // 2. Controller: suggestions, manual assignment of the new job, drag-and-drop.
  const ctrl = await newPage(browser, "controller", { viewport: { width: 1500, height: 2200 } });
  await signIn(ctrl, "controller@snowber.test");
  await ctrl.goto(`${BASE}/controller/dispatch`);
  await ctrl.locator("[data-testid=waiting-job]", { hasText: "77 Maple Crescent" }).waitFor();
  await ctrl.getByRole("button", { name: "Suggest assignments" }).click();
  const apply = ctrl.getByRole("button", { name: /Apply \d+ suggestion/ });
  await apply.waitFor();
  step("2", await apply.innerText());
  await apply.click();
  await ctrl.getByText(/jobs? assigned\./).first().waitFor();
  let cleanerEmail = await one(`select u.email from "Job" j join "User" u on u.id = j."cleanerId" where j.id = $1`, [jobId]);
  if (!cleanerEmail) {
    await ctrl.locator("[data-testid=waiting-job]", { hasText: "77 Maple Crescent" }).locator("select").selectOption({ index: 1 });
    for (let i = 0; i < 40 && !cleanerEmail; i++) {
      await ctrl.waitForTimeout(250);
      cleanerEmail = await one(`select u.email from "Job" j join "User" u on u.id = j."cleanerId" where j.id = $1`, [jobId]);
    }
  }
  check(cleanerEmail, "new job is assigned");
  await badge(home, "Assigned").waitFor({ timeout: 15000 });
  step("2 assigned to", cleanerEmail, "— homeowner page updated live");
  const draggable = ctrl.locator("[data-testid=waiting-job]").filter({ hasNotText: "Blower" }).first();
  if (await draggable.count()) {
    const address = (await draggable.locator("a").first().innerText()).trim();
    await draggable.dragTo(ctrl.locator("[data-testid=cleaner-column]").filter({ hasNotText: "No shift in this window" }).last());
    let assignee = null;
    for (let i = 0; i < 20 && !assignee; i++) {
      await ctrl.waitForTimeout(250);
      assignee = await one(
        `select u.name from "Job" j join "Property" p on p."id" = j."propertyId" join "User" u on u.id = j."cleanerId" where p.address = $1 order by j."createdAt" desc limit 1`,
        [address],
      );
    }
    step("2 drag-and-drop", address, "→", assignee ?? "(rejected — see toast)");
  }
  await ctrl.screenshot({ path: `${SHOTS}/02-dispatch.png`, fullPage: true });

  // 3. Cleaner on a phone: before photo starts the job, after photo completes it.
  const clean = await newPage(browser, "cleaner", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await signIn(clean, cleanerEmail);
  await clean.goto(`${BASE}/cleaner/jobs/${jobId}`);
  await uploadPhoto(clean, "before", path.join(FIXTURES, "before.jpg"));
  await clean.getByRole("button", { name: "Take after photo & finish" }).waitFor({ timeout: 30000 });
  await badge(home, "In progress").waitFor({ timeout: 15000 });
  await uploadPhoto(clean, "after", path.join(FIXTURES, "after-old-exif.jpg"));
  await clean.getByText("Nice work!").waitFor({ timeout: 30000 });
  await clean.screenshot({ path: `${SHOTS}/03-cleaner-job.png`, fullPage: true });
  check((await one(`select status from "Job" where id = $1`, [jobId])) === "COMPLETED", "job completed");
  check(await one(`select "comparisonKey" from "Job" where id = $1`, [jobId]), "comparison image stored");
  check((await one(`select flagged from "JobPhoto" where "jobId" = $1 and kind = 'AFTER'`, [jobId])) === true, "old after photo flagged");
  step("3 photos processed; old after photo flagged for the controller");

  // 4. Homeowner sees it live, confirms and reviews; the cleaner is credited.
  await home.getByText("Your cleaner is done").waitFor({ timeout: 15000 });
  await home.screenshot({ path: `${SHOTS}/04-homeowner-done.png`, fullPage: true });
  await home.getByRole("button", { name: /Looks good/ }).click();
  await badge(home, "Confirmed").waitFor({ timeout: 15000 });
  await home.getByRole("radio", { name: "4 stars" }).click();
  await home.getByRole("button", { name: "Submit review" }).click();
  await home.getByText("4.0").first().waitFor();
  step("4 confirmed; ledger entry (cents):", await one(`select "amountCents" from "LedgerEntry" where "jobId" = $1 and type = 'EARNING'`, [jobId]));

  // 5. Cleaner cashes out.
  await clean.goto(`${BASE}/cleaner/earnings`);
  await clean.getByRole("button", { name: "Pay out balance" }).click();
  await clean.getByRole("dialog").getByRole("button", { name: "Pay out" }).click();
  await clean.getByText(/sent \(simulated\)/).first().waitFor();
  check(
    Number(await one(`select coalesce(sum("amountCents"),0) from "LedgerEntry" l join "User" u on u.id = l."cleanerId" where u.email = $1`, [cleanerEmail])) === 0,
    "balance is zero after payout",
  );
  step("5 payout done");

  // 6. PostgreSQL exclusion constraints surface as friendly messages.
  const ben = await newPage(browser, "ben");
  await signIn(ben, "ben.cleaner@snowber.test");
  await ben.goto(`${BASE}/cleaner/tools`);
  await ben.locator("#toolId").click();
  await ben.getByRole("option", { name: /Blower #2/ }).click();
  await ben.getByRole("button", { name: "Request tool" }).click();
  await ben.getByText("Request sent to the controller.").waitFor();
  await ctrl.goto(`${BASE}/controller/tools`);
  await ctrl.getByRole("button", { name: "Approve" }).first().click();
  await ctrl.getByText("Rental approved and fee charged.").first().waitFor();
  await ctrl.getByText("Rental requests (1)").waitFor();
  await ctrl.getByRole("button", { name: "Approve" }).first().click();
  await ctrl.getByText(/already approved for an overlapping time/).first().waitFor();
  await ben.goto(`${BASE}/cleaner/shifts`);
  await ben.getByLabel("Starts").waitFor();
  await ben.getByRole("button", { name: "Post shift" }).click();
  await ben.getByText("This shift overlaps one you already posted.").waitFor();
  step("6 overlapping rental and overlapping shift rejected by the database");

  // 7. Access control.
  await home.goto(`${BASE}/controller`);
  await home.waitForURL(`${BASE}/homeowner`);
  const outsiderEmail = cleanerEmail === "ava.cleaner@snowber.test" ? "chloe.cleaner@snowber.test" : "ava.cleaner@snowber.test";
  const outsider = await newPage(browser, "outsider");
  await signIn(outsider, outsiderEmail);
  await outsider.goto(`${BASE}/cleaner/jobs/${jobId}`);
  await outsider.getByText("We couldn't find that page").waitFor();
  check((await fetch(`${BASE}/api/events`)).status === 401, "event stream needs a session");
  step("7 access checks passed");

  console.log("\n✔ Storm-morning walkthrough passed");
} catch (error) {
  console.error("\n✘ Walkthrough failed:", error);
  process.exitCode = 1;
} finally {
  if (errors.length) console.log(`\nBrowser console errors (${errors.length}):\n  ${[...new Set(errors)].join("\n  ")}`);
  await browser.close();
  await db.end();
}
