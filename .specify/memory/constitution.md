<!--
Sync Impact Report
Version change: (template, unratified) → 1.0.0
Modified principles: n/a (initial ratification)
Added sections:
  - Core Principles: I. Modular DDD & Clean Architecture, II. Strict Typing & Result-Based
    Error Handling, III. Verified-Before-Done (NON-NEGOTIABLE), IV. Server-Side Performance
    & Data Discipline, V. Security, Audit & Crisis-Ready UX
  - Stack & Infrastructure Constraints
  - Development Workflow & Commit Discipline
  - Governance
Removed sections: none (initial fill of placeholder scaffold)
Follow-up TODOs: none
-->

# SOS Jaraguá Constitution

## Core Principles

### I. Modular DDD & Clean Architecture (NON-NEGOTIABLE)

The system MUST remain a single modular monolith (Next.js App Router, deployed as one
Vercel project) organized as bounded contexts under `src/modules/<modulo>/`
(`identidade`, `voluntariado`, `estoque`, `logistica`, `notificacoes`, `auditoria`,
`contingencia`). Each module MUST expose exactly four layers — `domain/`,
`application/{use-cases,ports}/`, `infrastructure/`, `presentation/{actions,queries}/`
— with dependencies pointing inward only (`domain ← application ← infrastructure /
presentation`). `domain/` MUST NOT import Next.js, Drizzle, or Mongo. A module MUST
NOT import another module's repositories or Drizzle schema directly; cross-module reads
happen only through the read-only ports (`EstoqueQueryPort`, `VoluntariadoQueryPort`,
etc.) that the owning module explicitly exposes. `presentation/` layers stay thin: Zod
parsing, session/role checks, exactly one use-case call, then `revalidateTag`/
`updateTag` — no business rules there.

**Rationale**: This structure is mandated by `spec/REQUISITOS_NAO_FUNCIONAIS.md` §1 and
`spec/DESIGN.md` §1–§4, not a stylistic preference. Voluntariado and Estoque are
mission-critical domains that must stay independently reasoned-about and testable even
though they share one Postgres database and one deployable.

### II. Strict Typing & Result-Based Error Handling

All code (frontend and backend) MUST be written in TypeScript with strict mode enabled
— no `any` used to bypass the compiler, no `// @ts-ignore` without a linked follow-up.
Use cases and Server Actions MUST return the shared `Result<T, DomainError>` type from
`src/shared/kernel/` rather than throwing across layer boundaries; domain errors are
values, not exceptions, once they leave `domain/`. All external input (form submissions,
Server Action arguments, route handler bodies) MUST be validated with Zod at the
`presentation/` boundary before reaching `application/`.

**Rationale**: `spec/REQUISITOS_NAO_FUNCIONAIS.md` §4.2 mandates rigorous typing across
the unified codebase; `spec/DESIGN.md` §4–§5 defines the `Result<T, E>`/`DomainError`
kernel as the contract between layers so failure paths (e.g., invalid CPF, expired
session) are explicit and testable rather than hidden in try/catch.

### III. Verified-Before-Done (NON-NEGOTIABLE)

A task or feature is only complete once it has been manually exercised by running the
application and walking the actual user flow — not merely once code compiles or is
written. In `spec/TASKS.md`, a checkbox MUST stay `[ ]` until the behavior has been
verified this way; marking `[x]` on written-but-unrun code is a constitution violation.
Sections of `spec/TASKS.md` MUST be executed in their documented order (1→12) because
later modules have real foreign-key and business dependencies on earlier ones
(e.g., Voluntariado/Estoque depend on `user.id` from Identidade).

**Rationale**: Codified in `AGENTS.md`/`CLAUDE.md` project instructions and
`spec/TASKS.md` "Regras de uso" — this is an emergency-response system; unverified code
that looks done but silently fails in the field carries outsized real-world risk.

### IV. Server-Side Performance & Data Discipline

Critical read paths (e.g., the item list on the Saída screen) MUST respond in under
300ms. Listings of volume data (estoque, voluntários) MUST use TanStack Table with
server-side pagination — client-side pagination over full datasets is not acceptable.
Server Actions MUST return only the fields the caller needs, and reads MUST go through
`src/shared/cache/` `cacheTag`/`cacheLife` conventions plus TanStack Query so redundant
round-trips to Neon Postgres are avoided.

**Rationale**: `spec/REQUISITOS_NAO_FUNCIONAIS.md` §4.1 sets these as hard NFRs; the
system must stay responsive when used from the field during a crisis, often on
constrained mobile connections.

### V. Security, Audit & Crisis-Ready UX

Every write to a critical entity (Voluntariado, Estoque, Identidade role changes) MUST
be wrapped by the Auditoria service writing an immutable record to MongoDB
(`audit_logs`) as a best-effort side effect that never blocks the primary transaction.
Staff routes (`(staff)/*`) MUST be protected both in `proxy.ts` (role map, Node
runtime) and again in the staff layout server component (defense in depth) — never
rely on middleware alone. Coordenador/Membro da Defesa Civil sessions MUST enforce
`STAFF_INACTIVITY_TIMEOUT_MINUTES` timeout, since these accounts operate on shared
operations-center computers. All UI copy MUST be pt-BR, and every screen used during an
active emergency MUST be usable under stress on both mobile and desktop — no flow may
assume a calm, unhurried operator.

**Rationale**: `spec/DESIGN.md` §13 (audit as wrapper, best-effort) and
`spec/REQUISITOS_NAO_FUNCIONAIS.md` §2.2–§3 set these constraints; this is disaster-relief
software where session hijacking on a shared terminal or an unreadable form under
pressure has real consequences, not just UX polish.

## Stack & Infrastructure Constraints

- **Framework/runtime**: Next.js 16 (App Router, Turbopack) with `cacheComponents: true`,
  React 19, TypeScript. Deploys as a single Vercel project.
- **Data**: Neon Postgres (transactional data) via Drizzle ORM (`casing: 'snake_case'`,
  pooled client via `@neondatabase/serverless` for runtime, unpooled for migrations);
  MongoDB Atlas reserved exclusively for the immutable `audit_logs` collection — it MUST
  NOT be used as a general-purpose data store.
- **Auth**: better-auth with `emailAndPassword` plus Google/Facebook social providers;
  role and `ativo` as `user` additionalFields; `lastActivityAt` on `session`.
- **UI**: Ark UI + Tailwind CSS v4 design system, TanStack Query for client data,
  TanStack Table for paginated listings, react-hook-form + Zod for forms.
  `lucide-react` is the only icon set.
  Do NOT introduce a competing UI/component library.
- **Explicitly excluded**: no dedicated cache database (Redis/Valkey), no external file
  storage service. Do not add either without a constitution amendment.
- **Email/exports**: Resend for transactional email; `xlsx` (SheetJS) for
  spreadsheet/report generation.

## Development Workflow & Commit Discipline

- Commits MUST follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.) to
  keep history traceable and changelog-friendly (`spec/REQUISITOS_NAO_FUNCIONAIS.md`
  §4.2).
- Any behavioral question (field name, validation rule, workflow order, architectural
  choice) MUST be resolved by reading the relevant `spec/*.md` document, never decided
  ad hoc — `spec/REQUISITOS_NEGOCIO.md` (BRD), `spec/REQUISITOS_NAO_FUNCIONAIS.md` (NFR),
  `spec/DESIGN.md`, `spec/DESIGN_SYSTEM.md`, and `spec/DB_SCHEMA.md` are the sources of
  truth referenced by `spec/TASKS.md`.
- Each `spec/TASKS.md` task cites its BRD requirement code(s) and the relevant spec
  section; read that referenced section before implementing the task.
- Before writing code in a module, confirm which layer it belongs in (domain/
  application/infrastructure/presentation) per Principle I — when unclear, check
  `spec/DESIGN.md` §4–§5 before guessing.

## Governance

This constitution supersedes any conflicting ad hoc practice, prior undocumented
convention, or generic framework default. All PRs and code reviews MUST verify
compliance with the Core Principles above; any deviation MUST be justified in the PR
description and, if it represents a lasting change rather than a one-off exception,
proposed as a constitution amendment rather than silently normalized.

**Amendment procedure**: propose the change (what principle/section, why, and impact)
via `/speckit-constitution`, update this file, and record the rationale in the Sync
Impact Report at the top of the file. Amendments to Core Principles or removal of a
NON-NEGOTIABLE rule require explicit user sign-off before being ratified.

**Versioning policy** (semantic versioning applied to governance):
- MAJOR — backward-incompatible principle removal or redefinition (e.g., dropping the
  Clean Architecture layering requirement).
- MINOR — a new principle or materially expanded section added.
- PATCH — clarification, wording, or non-semantic refinement.

**Compliance review**: `spec/TASKS.md` execution and `AGENTS.md`/`CLAUDE.md` runtime
guidance operate under this constitution; if they ever conflict with it, this document
wins and the conflicting file MUST be updated to match.

**Version**: 1.0.0 | **Ratified**: 2026-08-12 | **Last Amended**: 2026-08-12
