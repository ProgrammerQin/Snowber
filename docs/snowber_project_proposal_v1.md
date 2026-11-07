# Project Proposal: Snowber (Neighborhood Snow Clearing & Dispatch Platform)

## 1. Motivation

### The Problem
In regions experiencing heavy winter snowfall, residential snow removal presents an urgent, recurring logistical challenge. Following a snowstorm, homeowners face strict municipal bylaws requiring sidewalks and driveways to be cleared within a narrow window (often 12 to 24 hours), alongside immediate safety and mobility hazards. Simultaneously, many local residents, students, and gig workers seek flexible seasonal income but lack the heavy equipment, customer base, or route coordination required to operate efficiently.

### Limitations of Existing Approaches
Current residential snow removal options fall into two flawed extremes:
1. **Commercial Landscaping Contracts:** Professional plowing companies typically require expensive seasonal retainers ($600–$1,500+ per winter) regardless of actual snowfall frequency, and prioritize commercial lots over residential driveways.
2. **Informal Peer-to-Peer Marketplaces:** Platforms such as Craigslist, Nextdoor, or local social media groups lack structured scheduling, standardized pricing, accountability, and equipment support. Cleaners waste significant time commuting between scattered houses rather than clearing clustered neighborhood driveways, and homeowners face high no-show rates with no visual verification of completed work.

### Stakeholders and Value Proposition
**Snowber** ("Snow Neighbor" / "Snow Uber") bridges this gap by combining community-based labor with centralized neighborhood dispatch and equipment rental. The platform serves three distinct user groups:
* **House Owners:** Need a reliable, transparent way to book on-demand snow clearing based on their specific driveway/walkway dimensions and preferred time slots, with visual proof ("before" and "after" photos) before payment is finalized.
* **Snow Cleaners:** Want to book predictable working shifts, rent commercial-grade tools (ergonomic shovels, snowblowers, ice melt spreaders) from a local hub, follow an optimized neighborhood route, and receive guaranteed payouts.
* **Central Office Controllers (Dispatchers):** Operate local neighborhood hubs that match cleaner shift availability with homeowner requests, map efficient routes, manage tool rental inventory, and oversee quality assurance.

Addressing this problem matters because it transforms an unorganized, physically demanding chore into a coordinated community micro-economy—improving winter accessibility for residents (especially seniors and people with mobility impairments) while creating structured, well-equipped local employment.

---

## 2. Objectives, Architecture, and Key Features

### Main Project Objectives and Core Functionality
Our primary objective is to build a responsive, role-based web application that streamlines the lifecycle of a residential snow-clearing job from request to verified payout. Core functionality is organized around three role-specific portals:

1. **House Owner Portal:**
   * Register property location (geocoded address) and select driveway/walkway slot size (e.g., Single Car, Double Car, Corner Lot Sidewalk).
   * View dynamic pricing calculated from slot size and snow accumulation tier, select desired completion time slots, and submit booking requests.
   * Track job status, view "before" and "after" verification photos, process payments, and submit ratings/reviews for cleaners.
2. **Snow Cleaner Portal:**
   * Post working availability windows (shift blocks) and reserve rental tools from the central office.
   * View assigned sequential house routes on an interactive map.
   * Upload timestamped "before" and "after" photos to verify job completion, track earnings/payouts, and leave bidirectional reviews regarding property accuracy and homeowner instructions.
3. **Central Office Controller Dashboard:**
   * View incoming homeowner requests alongside available cleaners and shift durations.
   * Match cleaners to house owners, group nearby properties, and generate mapped service routes.
   * Manage physical tool inventory (check-out, return inspection, availability tracking) and resolve flagged disputes.

### Planned Application Architecture

#### Architectural Approach: Next.js Full-Stack
We chose a **Next.js (App Router) full-stack architecture** over a decoupled React frontend and Express backend. Because Snowber relies heavily on shared data contracts across three distinct user roles, Next.js allows us to share TypeScript interfaces and Zod validation schemas seamlessly between client components, Server Components, and API Route Handlers. This eliminates cross-origin (CORS) configuration overhead, simplifies authentication middleware, and allows us to deploy a unified repository without managing two separate hosting pipelines.

#### Main Components and Interactions
* **Presentation Layer (Client & Server Components):** Role-protected views (`/owner`, `/cleaner`, `/controller`) built with React, Tailwind CSS, and **shadcn/ui** (Radix UI primitives). Server Components fetch initial dashboard state directly, while interactive views (map dispatching, photo uploads, shift calendars) use Client Components.
* **Application / API Layer (Next.js Route Handlers & Server Actions):** Handles business logic, role-based access control (RBAC), pricing calculations, tool inventory validation, and third-party API orchestration.
* **Data Access Layer (Prisma ORM + PostgreSQL):** Enforces relational integrity, transactional updates (e.g., locking a tool and assigning a shift atomically), and type-safe queries.

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
We selected **PostgreSQL** over SQLite to support concurrent multi-user transactions, native enum types, and structured coordinate indexing for neighborhood routing. Data will be accessed via **Prisma ORM**.

Core entities and relationships include:
* `User`: Stores authentication credentials, role (`OWNER`, `CLEANER`, `CONTROLLER`), contact details, and average rating.
* `Property`: Belongs to an `OWNER` (`User`). Stores address, latitude/longitude coordinates ($lat, lng$), and `slotSize` (`SMALL`, `MEDIUM`, `LARGE`, `CUSTOM`).
* `ServiceRequest`: Created by an `OWNER` for a `Property`. Stores target time window, calculated price $P$, status (`PENDING`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `VERIFIED`), and foreign key to the assigned `CleanerShift`.
* `CleanerShift`: Created by a `CLEANER` (`User`). Defines start/end availability timestamps, status, and ordered route sequence of assigned `ServiceRequest` records.
* `Tool` & `ToolRental`: `Tool` tracks central office equipment inventory (type, condition, total stock, available stock). `ToolRental` links a `CleanerShift` to rented `Tool` items with check-out and return timestamps.
* `JobPhoto`: Linked to `ServiceRequest`. Stores photo type (`BEFORE` or `AFTER`), Cloud Storage object key, public URL, and upload timestamp.
* `Review`: Bidirectional entity linking a `ServiceRequest`, `reviewerId`, and `revieweeId` with a numeric rating ($1\text{--}5$) and text comment.

#### Cloud Storage Design
We will use **AWS S3** (or S3-compatible **Cloudflare R2**) to handle all "before" and "after" snow-clearing photos. Storing binary images directly in PostgreSQL degrades query performance and bloats database backups.
* **Workflow:** When a cleaner initiates a photo upload, the Next.js backend validates their active assignment and generates a short-lived **S3 Pre-signed PUT URL** using the AWS SDK. The client uploads the image file directly from the browser/phone to the S3 bucket.
* **Data Linkage:** Once the upload succeeds, the client invokes a Server Action that records the S3 object key, public CDN URL, `photoType` (`BEFORE` | `AFTER`), and timestamp in the `JobPhoto` PostgreSQL table linked to the specific `ServiceRequest`.

#### Important Frontend–Backend Interactions and Data Flows
1. **Booking & Pricing Flow:** When a House Owner selects a property slot size $A$ (in $\text{m}^2$) and time urgency tier $u$, the frontend requests a price quote. The backend computes the deterministic fee using base rate $B$ and unit rate $r$:
   $$P = B + (A \times r) \times u$$
   Submitting the form creates a `PENDING` `ServiceRequest` record in PostgreSQL.
2. **Controller Dispatch & Tool Reservation Flow:** The Central Office Controller loads the dispatch dashboard, which fetches all `PENDING` requests and unassigned `CleanerShift` windows for a given date. When the controller assigns a cleaner to a batch of houses and allocates a tool (e.g., snowblower), a Prisma database transaction (`prisma.$transaction`) updates the `ServiceRequest` statuses to `SCHEDULED`, records the route order, creates a `ToolRental` entry, and decrements the available tool stock.
3. **Verification & Payout Flow:** A cleaner cannot mark a job `COMPLETED` until both a `BEFORE` and an `AFTER` `JobPhoto` record exist in PostgreSQL for that `ServiceRequest`. Once uploaded, the homeowner and controller are notified, unlocking the review form and triggering simulated payout settlement.

#### Key UI and UX Considerations
Because our three user personas operate in drastically different environments, our UI/UX prioritizes context-aware ergonomics:
* **Cleaner Mobile-First View:** Cleaners operate outdoors in freezing conditions, often wearing gloves. Their interface is designed mobile-first with high-contrast colors, oversized touch targets (minimum $48 \times 48\text{ px}$ buttons), and a linear step-by-step workflow ("Navigate to House" $\rightarrow$ "Snap Before Photo" $\rightarrow$ "Snap After Photo" $\rightarrow$ "Complete").
* **Controller Desktop Command Center:** Dispatchers require high information density. Their view uses a split-screen desktop layout combining a filterable `shadcn/ui` data table of shifts/requests on the left and an interactive neighborhood map on the right.
* **House Owner Guided Booking:** Uses a clean, step-by-step wizard with visual driveway size presets so homeowners do not need to measure exact square footage manually.

### Incorporation of Required Course Technologies
* **TypeScript:** Enforced strictly (`strict: true`) across frontend components, API routes, and Prisma queries to eliminate runtime type errors.
* **Next.js & React:** Powers the full-stack application, utilizing Server Components for fast initial loads and Client Components for interactive mapping and file uploads.
* **Tailwind CSS & Component Library (`shadcn/ui`):** Provides accessible, customizable UI primitives (modals, date-time pickers, data tables, toast notifications, and badges) styled consistently with Tailwind utility classes.
* **PostgreSQL:** Hosted relational database managing users, schedules, inventory, and job states.
* **Cloud Storage (AWS S3 / R2):** Stores user-uploaded verification images via pre-signed URLs.

### Planned Advanced Features
1. **Geospatial Dispatching & Route Optimization (Mapbox GL JS + OSRM):**
   * *Integration:* Within the Central Office Controller dashboard, all open `ServiceRequest` locations are rendered as color-coded pins on an interactive map. When the controller assigns multiple houses to a single cleaner's shift, the backend queries the Open Source Routing Machine (OSRM) / Mapbox Directions API to order the waypoints by shortest travel time, saving the optimized polyline and stop sequence to the `CleanerShift` record so the cleaner can follow turn-by-turn neighborhood routing.
2. **Photo-Gated Escrow Payment & Payout System (Stripe Checkout & Connect Simulation):**
   * *Integration:* When a House Owner books a slot, payment is authorized via Stripe Checkout (Test Mode). Funds are held in an application escrow state (`PAYMENT_HELD`). The backend state machine strictly prevents transitioning funds to the cleaner's balance (`PAID_OUT`) until both `BEFORE` and `AFTER` S3 photo keys are verified in the database, protecting both homeowners from no-shows and cleaners from non-payment.

### Scope, Tradeoffs, and Feasibility
* **Key Tradeoff (Human-in-the-Loop Dispatch vs. Autonomous Matching):** We intentionally designed scheduling around a **Central Office Controller** rather than a fully autonomous Uber-style algorithmic matching engine. Fully automated dispatch requires complex real-time background workers, live GPS socket streaming, and edge-case handling for tool pickups. Using a human Controller satisfies the domain need (coordinating physical tool rentals at a neighborhood hub) while keeping the technical scope achievable within the semester timeline.
* **Assumptions:** We assume properties are within a bounded municipal service zone and that Stripe operates in sandbox/test mode.

---

## 3. Project Plan and Team Responsibilities

### Major Stages of Development
* **Stage 1: Foundation & Database Architecture (Weeks 1–2):** Initialize Next.js TypeScript repository, configure Tailwind CSS and `shadcn/ui`, finalize Prisma schema, provision PostgreSQL and S3 bucket, and implement role-based authentication.
* **Stage 2: Core Role Workflows (Weeks 3–4):** Build House Owner booking wizard, Cleaner availability/shift booking and tool selection, and Controller CRUD tables for requests and tool inventory.
* **Stage 3: Cloud Storage & Advanced Features (Weeks 5–6):** Implement S3 pre-signed URL photo uploads, integrate Mapbox/Leaflet route visualization and waypoint ordering for the Controller, and integrate Stripe Checkout test flows.
* **Stage 4: Integration, Bidirectional Reviews & Polish (Weeks 7–8):** Connect end-to-end job state transitions, implement cleaner-to-owner and owner-to-cleaner review modules, conduct cross-role testing, and deploy to production.

### Team Responsibilities
4-member engineering structure, responsibilities are divided vertically by domain slice while sharing a unified database schema:
* **Member 1 (House Owner Experience & Payments Lead):** Owns property registration, slot-size pricing calculator, time-slot booking flow, Stripe Checkout integration, and homeowner review submission UI.
* **Member 2 (Snow Cleaner Experience & Cloud Storage Lead):** Owns cleaner shift scheduling, mobile-first job execution interface, S3 pre-signed URL upload pipeline for before/after photos, earnings tracker, and cleaner review UI.
* **Member 3 & 4 (Central Office Controller & Geospatial Lead):** Owns controller dispatch dashboard, cleaner-to-house matching transaction logic, Mapbox/OSRM route visualization, and tool rental inventory management.

### Component Integration Strategy
To prevent integration bottlenecks:
1. **Schema-First Contract:** The team will lock the `schema.prisma` file and shared TypeScript DTOs in Week 1. Any schema change requires a pull request review from all members.
2. **Database Seeding:** We will maintain a comprehensive `prisma/seed.ts` script containing realistic mock homeowners, cleaner shifts, tools, and Toronto neighborhood coordinates so every developer can build and test their portal independently against realistic state states.
3. **CI/CD & Branching:** Feature branches will merge into `main` via GitHub Pull Requests guarded by automated TypeScript type-checking (`tsc --noEmit`) and ESLint checks.

### Dependencies, Coordination Needs, and Risks
* **Critical Dependency:** The Controller matching dashboard (Member 3) depends on the data models created by the Owner booking flow (Member 1) and Cleaner shift flow (Member 2). *Mitigation:* Seed scripts will populate pending requests and shifts immediately in Week 2 so Member 3 is never blocked waiting for UI forms to be finished.
* **External API Risk:** Map routing or S3 CORS misconfigurations can stall frontend testing. *Mitigation:* Encapsulate S3 and Map API calls behind modular service wrappers early in Stage 2 so local mock fallbacks can be toggled during offline development.

---

## 4. Initial Team Reasoning and AI-Assisted Exploration

### 4.1 Initial Team Reasoning

#### Problem Framing
During our initial team brainstorming, we framed Snowber as a pure peer-to-peer gig app ("Uber for snow shoveling") where homeowners post a driveway and nearby cleaners immediately claim it. However, as we discussed real-world winter constraints, we realized pure peer-to-peer matching breaks down in two ways: many willing cleaners (such as university students) do not own heavy snowblowers or shovels, and individual cleaners claiming random houses results in inefficient zig-zagging across neighborhoods. We concluded that a useful solution needed a third stakeholder—a **Central Office Controller**—to manage a neighborhood equipment depot, rent out tools, schedule cleaner shifts, and group nearby houses into logical routes.

#### Initial Technical Hypotheses
1. **Architecture:** We initially considered building a separate Vite React SPA and an Express.js REST API, as team members had prior familiarity with Express routing.
2. **Image Handling & Storage:** One early idea was to convert "before" and "after" photos into Base64 strings and store them directly in a SQLite `TEXT` column to avoid setting up external cloud infrastructure.

#### Open Questions Identified Early
* How do we prevent cleaners from marking a driveway as "cleaned" without actually doing the work, or uploading old photos?
* How should pricing be determined so homeowners aren't haggling over every snowfall?
* Can we feasibly calculate multi-stop walking/driving routes for the Central Office Controller without paying for enterprise logistics APIs?

### 4.2 Exploration and Evaluation

#### Evolving Our Design Through Investigation
Through a combination of team discussions, reviewing course specifications, reading technical documentation, and targeted AI-assisted exploration, we systematically resolved our open questions and refined our architecture:

* **Course Material & Team Discussion (Database & Cloud Storage):** Reviewing the course requirements and PostgreSQL best practices quickly invalidated our initial Base64-in-SQLite hypothesis. Storing multiple high-resolution smartphone photos per job in a database table would severely degrade query performance and violate course requirements for dedicated cloud storage. Reading AWS S3 documentation led us to adopt the **Pre-signed URL pattern**, which keeps large binary payloads off our application server while maintaining strict access control.
* **Architectural Consolidation (Express vs. Next.js):** When mapping out the 15+ endpoints required to support three distinct user roles, we realized maintaining synchronized TypeScript types across separate frontend and backend repositories would create significant friction. Prototyping a small slice in Next.js App Router demonstrated that Server Actions and shared Prisma types reduced boilerplate by nearly 40%.
* **AI-Assisted Exploration (State Machine & Routing Feasibility):** After establishing our core three-role mental model, we used AI as an architectural sounding board in two specific areas:
  1. *Database Edge Cases:* We prompted an AI assistant to critique our initial ER diagram for scheduling conflicts. This highlighted a race condition where two controllers might assign the same snowblower or cleaner shift simultaneously, prompting us to introduce a dedicated `ToolRental` join table and wrap dispatch assignments in Prisma interactive transactions.
  2. *Geospatial API Evaluation:* We used AI to compare Google Maps Routes API, Mapbox Directions API, and Leaflet + OSRM for our Controller routing feature. Based on the comparison of free-tier limits and React library support (`react-map-gl`), we selected Mapbox GL JS with OSRM waypoint optimization as a feasible, zero-cost solution for student deployment.