# Project Proposal: Snowber (Neighborhood Snow Clearing & Dispatch Platform)

## 1. Motivation

### The Problem
In regions experiencing heavy winter snowfall, residential snow removal presents an urgent, recurring logistical challenge. Following a snowstorm, homeowners face strict municipal bylaws requiring sidewalks and driveways to be cleared within a narrow window (often 12 to 24 hours), alongside immediate safety and mobility hazards. Simultaneously, many local residents, students, and gig workers seek flexible seasonal income but lack the heavy equipment, customer base, or route coordination required to operate efficiently.

### Limitations of Existing Approaches
1. **Commercial Landscaping Contracts:** Seasonal retainers ($600–$1,500+) can be costly and inflexible for occasional residential clearing.
2. **Informal Peer-to-Peer Marketplaces:** Craigslist, Nextdoor, and social groups lack structured scheduling, pricing, accountability, and equipment support. Scattered bookings waste travel time, while homeowners risk no-shows and lack proof of completion.

### Stakeholders and Value Proposition
**Snowber** ("Snow Neighbor" / "Snow Uber") combines community labor, centralized dispatch, and equipment rental for three groups:
* **House Owners:** Book by driveway/walkway size and time slot, track progress, and verify completion through before/after photos.
* **Snow Cleaners:** Schedule shifts, rent tools (shovels, snowblowers, spreaders), follow neighborhood routes, and receive payouts.
* **Central Office Controllers (Dispatchers):** Match requests to cleaners, plan routes, manage equipment, and oversee quality.

Snowber improves winter accessibility, especially for seniors and residents with limited mobility, while offering flexible local work.

---

## 2. Objectives, Architecture, and Key Features

### Main Project Objectives and Core Functionality
Build a responsive, role-based web application managing snow-clearing jobs from request to verified payout:

1. **House Owner Portal:** Register geocoded properties and driveway/walkway sizes (Single Car, Double Car, Corner Lot Sidewalk); obtain pricing based on size and snowfall tier; select time slots, book, track progress, view before/after photos, pay, and review cleaners.
2. **Snow Cleaner Portal:** Post shift availability, reserve rental tools, view assigned routes on a map, upload timestamped before/after photos, track earnings, and review owners/property details.
3. **Central Office Controller Dashboard:** Review requests and available shifts, assign cleaners and grouped routes, manage tool check-out/returns/stock, and resolve disputes.

### Planned Application Architecture

#### Architectural Approach: Next.js Full-Stack
We chose **Next.js (App Router)** over separate React and Express applications to share TypeScript interfaces and Zod validation across three roles, simplify authentication and deployment, and avoid CORS configuration.

#### Main Components and Interactions
* **Presentation Layer:** React, Tailwind CSS, and **shadcn/ui** role-protected views (`/owner`, `/cleaner`, `/controller`); Server Components load dashboard data, and Client Components handle maps, uploads, and calendars.
* **Application / API Layer:** Next.js Route Handlers and Server Actions manage RBAC, pricing, matching, inventory, and external APIs.
* **Data Access Layer:** Prisma ORM + PostgreSQL provide type-safe queries, relational integrity, and atomic assignments.

```
+-----------------------------------------------------------------------+
|                     Client Browser (Mobile / Desktop)                 |
|  [House Owner UI]       [Snow Cleaner UI]       [Controller Dashboard]|
+---------+-----------------------+-------------------------+-----------+
          |                       | (Direct PUT via         |
          | (HTTPS / JSON)        |  Pre-signed URL)        |
          v                       v                         v
+---------------------------------+-------------------------+-----------+
|                 Next.js Full-Stack Server (App Router)                |
|  - Auth & RBAC Middleware       - Server Actions & API Route Handlers |
|  - Pricing & Matching Engine    - S3 Pre-signed URL Generator         |
+---------------------------------+-------------------------+-----------+
                                  |                         |
                 (Prisma Client)  |                         | (AWS SDK)
                                  v                         v
                    +---------------------------+   +-------------------+
                    |   PostgreSQL Database     |   |   Cloud Storage   |
                    | (Users, Jobs, Tools, etc.)|   | (Before/After Img)|
                    +---------------------------+   +-------------------+
```

#### Database Design
**PostgreSQL + Prisma ORM** support concurrent transactions, enums, and location data. Main entities:
* `User`: Credentials, role (`OWNER`, `CLEANER`, `CONTROLLER`), contact details, rating.
* `Property`: Owner, address, coordinates (`lat`, `lng`), `slotSize` (`SMALL`, `MEDIUM`, `LARGE`, `CUSTOM`).
* `ServiceRequest`: Property, owner, time window, price, assigned `CleanerShift`, and status (`PENDING`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`).
* `CleanerShift`: Cleaner, availability, status, ordered assigned jobs.
* `Tool` / `ToolRental`: Equipment type, condition, stock, and shift-linked check-out/return times.
* `JobPhoto`: Request, `BEFORE`/`AFTER` type, cloud object key/URL, upload time.
* `Review`: Request, reviewer/reviewee, 1–5 rating, comment.

#### Cloud Storage Design
We will use **AWS S3** (or S3-compatible **Cloudflare R2**) to handle all "before" and "after" snow-clearing photos. Storing binary images directly in PostgreSQL degrades query performance and bloats database backups.
* **Workflow:** When a cleaner initiates a photo upload, the Next.js backend validates their active assignment and generates a short-lived **S3 Pre-signed PUT URL** using the AWS SDK. The client uploads the image file directly from the browser/phone to the S3 bucket.
* **Data Linkage:** Once the upload succeeds, the client invokes a Server Action that records the S3 object key, public CDN URL, `photoType` (`BEFORE` | `AFTER`), and timestamp in the `JobPhoto` PostgreSQL table linked to the specific `ServiceRequest`.

#### Important Frontend–Backend Interactions and Data Flows
1. **Booking & Pricing:** For area $A$ (in $\text{m}^2$), urgency multiplier $u$, base $B$, and rate $r$, the server computes:
   $$P = B + (A \times r) \times u$$
   Booking creates a `PENDING` `ServiceRequest`.
2. **Dispatch & Tool Reservation:** Controller views pending requests and available shifts, then assigns grouped jobs and equipment. A Prisma `$transaction` schedules requests, saves route order, creates `ToolRental`, and decrements available stock atomically.
3. **Verification & Payout:** Jobs require both `BEFORE` and `AFTER` photos before `COMPLETED`; owners/controllers can verify, review, and trigger simulated payouts.

#### Key UI and UX Considerations
* **Cleaner Mobile-First:** High-contrast, glove-friendly 48×48 px touch targets; guided navigation → before photo → after photo → completion.
* **Controller Desktop:** Filterable `shadcn/ui` request/shift table beside a neighborhood map.
* **Owner Booking:** Step-by-step wizard with visual driveway-size presets.

### Incorporation of Required Course Technologies
* **TypeScript:** Strict typing for frontend, API, and Prisma.
* **Next.js & React:** Server and Client Components for dashboards, maps, and uploads.
* **Tailwind CSS & `shadcn/ui`:** Accessible, consistent forms, tables, pickers, and notifications.
* **PostgreSQL:** Relational records for users, jobs, shifts, and inventory.
* **AWS S3 / R2:** Pre-signed verification-photo uploads.

### Planned Advanced Features
1. **Geospatial Dispatching & Route Optimization (Mapbox GL JS + OSRM):**
   * *Integration:* Within the Central Office Controller dashboard, all open `ServiceRequest` locations are rendered as color-coded pins on an interactive map. When the controller assigns multiple houses to a single cleaner's shift, the backend queries the Open Source Routing Machine (OSRM) / Mapbox Directions API to order the waypoints by shortest travel time, saving the optimized polyline and stop sequence to the `CleanerShift` record so the cleaner can follow turn-by-turn neighborhood routing.
2. **Photo-Gated Escrow Payment & Payout System (Stripe Checkout & Connect Simulation):**
   * *Integration:* When a House Owner books a slot, payment is authorized via Stripe Checkout (Test Mode). Funds are held in an application escrow state (`PAYMENT_HELD`). The backend state machine strictly prevents transitioning funds to the cleaner's balance (`PAID_OUT`) until both `BEFORE` and `AFTER` S3 photo keys are verified in the database, protecting both homeowners from no-shows and cleaners from non-payment.

### Scope, Tradeoffs, and Feasibility
* **Human-in-the-Loop Dispatch:** A Controller manages matching and equipment instead of fully automated dispatch requiring live GPS, background workers, and pickup coordination. This keeps semester scope manageable.
* **Assumptions:** Properties fall within a bounded service zone; payments use Stripe sandbox/test mode.

---

## 3. Project Plan and Team Responsibilities

### Major Stages of Development
* **Stage 1 (Weeks 1–2):** Set up Next.js, TypeScript, Tailwind, `shadcn/ui`, Prisma/PostgreSQL, S3, and role-based authentication.
* **Stage 2 (Weeks 3–4):** Implement owner bookings, cleaner shifts/tool selection, and controller request/inventory CRUD.
* **Stage 3 (Weeks 5–6):** Add S3 photo uploads, Mapbox/Leaflet routing, and Stripe test payments.
* **Stage 4 (Weeks 7–8):** Integrate job states and bidirectional reviews, test across roles, and deploy.

### Team Responsibilities
Four members own distinct full-stack feature areas, share the Prisma schema, and participate in integration/testing:
* **Member 1 (Owner Booking & Payments):** Property registration, size-based pricing, booking/time-slot UI and APIs, Stripe Checkout test flow, and homeowner reviews.
* **Member 2 (Cleaner Workflow & Photo Verification):** Shift availability, mobile job UI, S3 pre-signed uploads, before/after verification flow, earnings display, and cleaner reviews.
* **Member 3 (Dispatch & Geospatial Routing):** Controller request/shift dashboard, cleaner-to-house matching APIs, grouped route assignment, Mapbox/OSRM integration, and map UI.
* **Member 4 (Inventory & Shared Workflow Integrity):** Tool catalog/stock dashboard, rental check-out/return APIs, transaction-safe inventory reservation, job-status validation and dispute handling, plus cross-role integration tests.

Each member implements frontend, backend, and database interactions for their area; all four review shared contracts and test end-to-end workflows.

### Component Integration Strategy
1. **Schema-First Contract:** Agree on `schema.prisma` and shared TypeScript DTOs in Week 1; review schema changes together.
2. **Database Seeding:** Use `prisma/seed.ts` with sample owners, cleaners, shifts, tools, and Toronto locations for independent testing.
3. **CI/CD & Branching:** Merge feature branches through GitHub PRs with `tsc --noEmit` and ESLint checks.

### Dependencies, Coordination Needs, and Risks
* **Data Dependencies:** Dispatch relies on owner requests and cleaner shifts; seed mock data early so Member 3 can work independently.
* **External APIs:** Wrap maps and S3 calls behind services and provide mock fallbacks for routing or CORS issues.

---

## 4. Initial Team Reasoning and AI-Assisted Exploration

### 4.1 Initial Team Reasoning

#### Problem Framing
Our initial idea was a peer-to-peer “Uber for snow shoveling” app: owners post jobs and cleaners claim them. Discussion revealed two problems: students may lack equipment, and independently claimed jobs create inefficient travel. We added a **Central Office Controller** to coordinate tool rentals, shifts, and clustered routes.

#### Initial Technical Hypotheses
1. **Architecture:** We first considered a Vite React SPA with an Express REST API, drawing on prior Express experience.
2. **Image Storage:** We considered Base64 before/after photos in SQLite `TEXT` fields to avoid cloud setup.

#### Open Questions Identified Early
* How can we discourage false or reused completion photos?
* How should standardized snowfall pricing work?
* Can we provide multi-stop routes without costly enterprise APIs?

### 4.2 Exploration and Evaluation

#### Evolving Our Design Through Investigation
Through a combination of team discussions, reviewing course specifications, reading technical documentation, and targeted AI-assisted exploration, we systematically resolved our open questions and refined our architecture:

* **Course Material & Team Discussion (Database & Cloud Storage):** Reviewing the course requirements and PostgreSQL best practices quickly invalidated our initial Base64-in-SQLite hypothesis. Storing multiple high-resolution smartphone photos per job in a database table would severely degrade query performance and violate course requirements for dedicated cloud storage. Reading AWS S3 documentation led us to adopt the **Pre-signed URL pattern**, which keeps large binary payloads off our application server while maintaining strict access control.
* **Architectural Consolidation (Express vs. Next.js):** When mapping out the 15+ endpoints required to support three distinct user roles, we realized maintaining synchronized TypeScript types across separate frontend and backend repositories would create significant friction. Prototyping a small slice in Next.js App Router demonstrated that Server Actions and shared Prisma types reduced boilerplate by nearly 40%.
* **AI-Assisted Exploration (State Machine & Routing Feasibility):** After establishing our core three-role mental model, we used AI as an architectural sounding board in two specific areas:
  1. *Database Edge Cases:* We prompted an AI assistant to critique our initial ER diagram for scheduling conflicts. This highlighted a race condition where two controllers might assign the same snowblower or cleaner shift simultaneously, prompting us to introduce a dedicated `ToolRental` join table and wrap dispatch assignments in Prisma interactive transactions.
  2. *Geospatial API Evaluation:* We used AI to compare Google Maps Routes API, Mapbox Directions API, and Leaflet + OSRM for our Controller routing feature. Based on the comparison of free-tier limits and React library support (`react-map-gl`), we selected Mapbox GL JS with OSRM waypoint optimization as a feasible, zero-cost solution for student deployment.
