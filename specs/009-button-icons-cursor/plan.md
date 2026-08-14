# Implementation Plan: Unified Button Icons and Cursor Feedback

**Branch**: `009-button-icons-cursor` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-button-icons-cursor/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Enhance the SOS Jaraguá button component to automatically display semantically relevant icons positioned to the left of button text, and apply pointer cursor feedback on hover to all enabled buttons. This improves visual clarity for emergency responders under stress and establishes a consistent interaction pattern across the application. The implementation extends the existing Ark UI button component wrapper with icon slot management and Tailwind cursor utilities, ensuring zero regression in functionality and accessibility.

## Technical Context

**Language/Version**: TypeScript (strict mode, per Constitution II)

**Primary Dependencies**:

- React 19
- Next.js 16 (App Router)
- Ark UI (button component wrapper already exists in `src/components/ui/Button.tsx`)
- Tailwind CSS v4
- Icon library: NEEDS CLARIFICATION (Lucide, Phosphor, or custom SVG icons)

**Storage**: N/A (UI component feature)

**Testing**: Vitest (unit/component tests); visual regression testing for cross-browser compatibility

**Target Platform**: Web browsers (desktop and mobile responsive)

**Project Type**: Web application (Next.js full-stack monolith on Vercel)

**Performance Goals**: Cursor feedback latency < 50ms (imperceptible to users); no performance regressions in button render time

**Constraints**:

- Icon positioning must respect existing button layout and spacing
- Cursor feedback must work on all button variants (primary, secondary, danger, outline, ghost)
- Disabled buttons must NOT show pointer cursor
- Accessibility must be maintained (keyboard navigation, screen reader support)
- No breaking changes to existing Button component API

**Scale/Scope**: All interactive buttons in the application (estimated 50+ button instances across 8+ pages)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Principle I (Clean Architecture)**: ✅ PASS

- Feature is purely presentational (UI layer); no business logic in domain/application layers
- Button component remains in `src/components/ui/`; no dependency violations

**Principle II (Strict Typing)**: ✅ PASS

- Implementation will use strict TypeScript with explicit types for icon props and button states
- No `any` types; follows project ESLint/Prettier conventions
- Conventional Commits for all commits (e.g., `feat: add button icons`)

**Principle III (Tests)**: ✅ PASS

- Presentation layer (button component) requires visual/behavioral testing via Vitest component tests
- Focus on acceptance criteria: icon rendering, cursor behavior, disabled state handling
- Visual regression testing recommended for cross-browser consistency

**Principle IV (Security)**: ✅ PASS

- No security implications; purely presentational enhancement
- No new data handling or authentication requirements

**Principle V (Non-blocking Audit)**: ✅ PASS

- No audit trail implications

**Principle VI (Operational Simplicity)**: ✅ PASS

- No new external dependencies (icon library likely already integrated)
- No infrastructure changes
- Monolith modular pattern preserved
- No breaking changes to existing APIs

**Clarification Needed**: Icon library source (Lucide, Phosphor, or custom) - see Technical Context above

## Project Structure

### Documentation (this feature)

```text
specs/009-button-icons-cursor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command) - icon library clarification
├── data-model.md        # Phase 1 output (/speckit-plan command) - button icon mapping model
├── quickstart.md        # Phase 1 output (/speckit-plan command) - validation scenarios
├── contracts/           # Phase 1 output (/speckit-plan command) - component contract
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── shared/ui/button/
│   ├── button.tsx               # Primary change: add cursor:pointer styling
│   └── button.test.tsx          # Tests: icon rendering, cursor behavior, disabled state
│
└── modules/*/presentation/
    └── [various pages]          # Secondary changes: audit and add icons to button instances

tests/
└── ui/button.test.tsx           # Component testing for cursor feedback and icon positioning
```

**Structure Decision**: This is a single-project web application (Next.js monolith). The feature requires:

1. **Primary change**: Update `src/shared/ui/button/button.tsx` to add hover cursor styling
2. **Secondary changes**: Audit all button usages across presentation modules and add `iconeInicio` props with semantically relevant icons
3. **Testing**: Add component tests to verify cursor behavior and icon rendering across all button variants and states
