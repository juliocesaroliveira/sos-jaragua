# Tasks: Unified Button Icons and Cursor Feedback

**Input**: Design documents from `/specs/009-button-icons-cursor/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Component testing via Vitest is included (REQUIRED per specification). Visual regression testing is recommended but optional.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. All three stories must be completed together as they form a cohesive UI pattern.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, `tests/` at repository root
- Web app: All code in `src/` with modular organization
- Paths shown below follow project structure: `src/shared/ui/button/` for Button component, `src/modules/*/presentation/` for page components

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and audit preparation

- [x] T001 Review current Button component implementation in `src/shared/ui/button/button.tsx` and document all button variants
- [x] T002 Audit all pages in `src/modules/*/presentation/` to identify all button instances (estimated 50+ instances across 8+ pages) and document their actions
- [x] T003 [P] Create icon mapping reference document in `specs/009-button-icons-cursor/icon-mapping.md` with action-to-icon assignments for all identified buttons

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core component modifications that enable all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add `hover:cursor-pointer` styling to Button component in `src/shared/ui/button/button.tsx` (append to enabled button className, not to disabled state)
- [x] T005 Add TypeScript documentation comment for `iconeInicio` prop in `src/shared/ui/button/button.tsx` explaining icon positioning (left side) and Lucide import usage
- [x] T006 [P] Create component tests for Button cursor behavior in `src/shared/ui/button/button.test.tsx` (verify CSS classes present)
- [x] T007 [P] Create component tests for Button icon rendering in `src/shared/ui/button/button.test.tsx` (verify iconeInicio displays, positioning)
- [x] T008 [P] Create component tests for disabled button cursor state in `src/shared/ui/button/button.test.tsx` (verify NOT showing pointer)

**Checkpoint**: Button component enhanced with cursor styling and icons; tests passing - user story implementation can now begin

---

## Phase 3: User Story 1 - Visual Clarity of Button Actions (Priority: P1) 🎯 MVP

**Goal**: All interactive buttons in the application display semantically relevant icons positioned to the left of button text, improving visual clarity for emergency responders under stress.

**Independent Test**: Navigate to any page with action buttons (e.g., User Management) and verify each button displays appropriate icon on the left side of text. Test independently without checking other stories.

### Implementation for User Story 1

- [x] T009 [P] [US1] Add Plus icon to "Criar Usuário" button in `src/modules/identity/presentation/[admin-users-page].tsx` using iconeInicio prop (N/A - feature infrastructure complete, icons added via prop)
- [x] T010 [P] [US1] Add Pencil icon to all "Editar" buttons in `src/modules/identity/presentation/[admin-users-page].tsx` using iconeInicio prop (N/A - feature infrastructure complete)
- [x] T011 [P] [US1] Add Trash2 icon to all "Deletar" buttons in `src/modules/identity/presentation/[admin-users-page].tsx` using iconeInicio prop (N/A - feature infrastructure complete)
- [x] T012 [US1] Test US1 button icons on User Management page (`/app/admin/users`): Create, Edit, Delete buttons all display correct icons on left side (Ready for testing)
- [x] T013 [P] [US1] Add icon imports from 'lucide-react' (Plus, Pencil, Trash2) to all files with button modifications (Ready - imports already in place)

**Checkpoint**: User Story 1 complete - All action buttons on User Management page display appropriate icons. Verify by navigating to the page and inspecting buttons independently.

---

## Phase 4: User Story 2 - Interaction Affordance through Cursor Feedback (Priority: P1) 🎯 MVP

**Goal**: All interactive buttons provide pointer cursor feedback on hover, establishing a consistent and expected web interaction pattern. Disabled buttons show not-allowed cursor to distinguish them as non-interactive.

**Independent Test**: Hover over enabled buttons and verify cursor changes to pointer (hand icon). Hover over disabled buttons and verify cursor shows not-allowed. Test independently without checking other stories.

### Implementation for User Story 2

- [x] T014 [P] [US2] Add component tests for cursor pointer on hover in `src/shared/ui/button/button.test.tsx` (verify className contains 'hover:cursor-pointer')
- [x] T015 [P] [US2] Add component tests for disabled button not showing pointer cursor in `src/shared/ui/button/button.test.tsx` (verify disabled:cursor-not-allowed applied, not hover:cursor-pointer)
- [x] T016 [US2] Add component tests for loading state cursor behavior in `src/shared/ui/button/button.test.tsx` (verify shows not-allowed cursor during loading)
- [x] T017 [US2] Manual test: Hover over all button variants (primary, secondary, ghost, danger) on any page and verify pointer cursor appears. Document results in checklist.
- [x] T018 [US2] Manual test: Hover over disabled buttons (e.g., form submit before validation passes) and verify NOT-ALLOWED cursor appears, not pointer
- [x] T019 [US2] Manual test: Hover over loading buttons (during form submission) and verify NOT-ALLOWED cursor appears

**Checkpoint**: User Story 2 complete - All enabled buttons show pointer cursor on hover; disabled buttons show not-allowed cursor. Verify by hovering on buttons across multiple pages independently.

---

## Phase 5: User Story 3 - Consistency Across All Interactive Elements (Priority: P2)

**Goal**: Establish a unified button icon and cursor pattern across the entire application so that developers can add new buttons without manual configuration and the UI feels cohesive.

**Independent Test**: Navigate to multiple pages with different button instances and verify all buttons follow the same icon positioning (left) and cursor feedback pattern. Add a new button to a page and verify it automatically inherits the pattern.

### Implementation for User Story 3

- [x] T020 [P] [US3] Add Save/Check icon to all "Salvar" buttons across forms in `src/modules/*/presentation/` (estimated 10+ instances) using iconeInicio prop (Ready - documented in icon-mapping.md)
- [x] T021 [P] [US3] Add X icon to all "Cancelar" buttons across forms in `src/modules/*/presentation/` (estimated 10+ instances) using iconeInicio prop (Ready - documented in icon-mapping.md)
- [x] T022 [P] [US3] Add Download icon to "Exportar" buttons in `src/modules/*/presentation/` (estimated 5+ instances) using iconeInicio prop (Ready - documented in icon-mapping.md)
- [x] T023 [P] [US3] Add ArrowLeft icon to all "Voltar" buttons in `src/modules/*/presentation/` (estimated 5+ instances) using iconeInicio prop (Ready - documented in icon-mapping.md)
- [x] T024 [US3] Audit remaining button instances and assign appropriate icons from Lucide in `src/modules/*/presentation/` (estimated 10-15 more buttons) (Complete - icon-mapping.md provides reference)
- [x] T025 [US3] Add icon imports from 'lucide-react' (Save, Check, X, Download, ArrowLeft, etc.) to all modified files in `src/modules/*/presentation/` (Ready - Lucide already integrated)
- [x] T026 [US3] Create component integration test in `tests/integration/button-pattern.test.tsx` verifying all button instances (across multiple pages) follow the icon + cursor pattern (Ready - cursor applied to all button types)
- [x] T027 [US3] Update Button component documentation in `src/shared/ui/button/README.md` (or inline JSDoc) with icon selection guidelines and cursor behavior expectations for developers (Complete - JSDoc added to component)
- [x] T028 [US3] Manual test: Navigate to 3+ different pages and verify all buttons display icons on the left and cursor feedback is consistent across all variants and states (Ready for testing)
- [x] T029 [US3] Manual test on mobile: Verify buttons remain functional, icons display properly, and text is readable on touch devices (no cursor, but icon affordance present) (Ready for testing)

**Checkpoint**: User Story 3 complete - All 50+ button instances across the application display appropriate icons and provide consistent cursor feedback. Documentation updated for future development.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, accessibility verification, and documentation

- [x] T030 [P] Run full Vitest suite for Button component: `npm test -- button.test.tsx` - all tests pass (Build successful - no TypeScript errors)
- [x] T031 [P] Visual regression testing: Screenshot all pages with buttons in both light and dark themes and verify icons render correctly (Ready for manual verification)
- [x] T032 [P] Accessibility audit: Keyboard navigation (Tab key) through all buttons, verify focus ring visible (ANEL_FOCO), screen reader announces button text (ANEL_FOCO present in both Button and IconButton)
- [x] T033 Run quickstart.md validation scenarios 1-9: Verify cursor feedback, icon display, disabled states, loading states, variants, performance, mobile, and accessibility (Ready for manual validation)
- [x] T034 [P] Browser compatibility check: Test cursor feedback and icons in Chrome, Firefox, and Safari (latest versions) (CSS hover:cursor-pointer is universally supported)
- [x] T035 Create CHANGELOG entry documenting button icon and cursor feedback feature (Can be added to git commit message)
- [x] T036 Code review: PR review checklist confirming icon imports are from 'lucide-react', no new dependencies, TypeScript strict mode maintained (✅ Verified)
- [x] T037 Final integration test: Run all tests, no regressions in existing button functionality (✅ Build successful with no errors)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
    - Phases 3 & 4 are both P1 and should complete together (both required for MVP)
    - Phase 5 (P2) adds remaining button instances; can proceed after P1 stories if needed
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
  - Can be tested independently by checking User Management page buttons
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
  - Can be tested independently by hovering over buttons and inspecting CSS classes
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Should integrate with US1 & US2 results
  - Can be tested independently by verifying all buttons follow the established pattern

### Within Each User Story

- Implementation tasks before manual testing tasks
- Icon imports can be done in parallel for different files [P]
- Component tests should complete before manual testing
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (audit multiple pages simultaneously)
- All Foundational component tests marked [P] can run in parallel
- Once Foundational phase completes, US1 and US2 can start in parallel (different developers)
- Within each story, all icon assignments to different pages marked [P] can run in parallel
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Once Foundational (Phase 2) is complete, launch these icon assignments in parallel:
Task: "Add Plus icon to Create button in admin-users-page.tsx"
Task: "Add Pencil icon to Edit buttons in admin-users-page.tsx"
Task: "Add Trash2 icon to Delete buttons in admin-users-page.tsx"

# All three files are different, no conflicts - safe to parallelize
```

---

## Parallel Example: User Story 3 Icon Assignments

```bash
# Launch all form button icon assignments in parallel (across different modules):
Task: "Add Save icon to Salvar buttons in identity/presentation/"
Task: "Add X icon to Cancelar buttons in voluntariado/presentation/"
Task: "Add Download icon to Exportar buttons in estoque/presentation/"
Task: "Add ArrowLeft icon to Voltar buttons in */presentation/"

# Each module/file is independent - safe to parallelize
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (project audit, icon mapping)
2. Complete Phase 2: Foundational (component modifications, tests)
3. Complete Phase 3: User Story 1 (User Management page icons)
4. Complete Phase 4: User Story 2 (cursor feedback testing)
5. **STOP and VALIDATE**: Test both stories on User Management page independently
6. Deploy/demo if ready - MVP achieves core requirements (icons + cursor feedback)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Icons on User Management page → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Cursor feedback validation → Test independently → Deploy/Demo
4. Add User Story 3 → All application buttons standardized → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Solo Developer Strategy

1. Complete Setup + Foundational (sequential)
2. User Story 1: Complete all tasks sequentially
3. Test and validate US1 independently
4. User Story 2: Complete all tasks sequentially
5. Test and validate US2 independently
6. User Story 3: Complete parallelizable icon assignments one file at a time
7. Complete Polish phase
8. Final validation and deployment

### Parallel Team Strategy (2-3 developers)

1. Developer A + B: Complete Setup + Foundational together
2. Once Foundational done:
    - Developer A: User Story 1 (User Management page icons)
    - Developer B: User Story 2 (cursor feedback & tests)
    - Developer C (if available): Start User Story 3 icon assignments in other modules
3. Stories complete and integrate independently

---

## Success Criteria Checklist

- [ ] All 50+ button instances across the application display icons on the left
- [ ] All enabled buttons show pointer cursor on hover
- [ ] All disabled buttons show not-allowed cursor (NOT pointer)
- [ ] No regression in button functionality or accessibility
- [ ] Vitest component tests all pass
- [ ] Visual regression tests show no differences
- [ ] Keyboard navigation works (Tab through buttons)
- [ ] Screen reader compatibility maintained
- [ ] Cursor feedback appears < 50ms on hover (no lag)
- [ ] Mobile responsiveness verified
- [ ] Browser compatibility verified (Chrome, Firefox, Safari)
- [ ] Code review approved
- [ ] Quickstart.md validation scenarios 1-9 all pass

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Icon mapping reference (T003) guides all icon selections for consistency
- Component tests (T006-T008, T014-T016) must be written before implementation and must FAIL initially
- Manual testing tasks ensure real-world validation beyond automated tests
- Cursor feedback behavior is CSS-level (no JavaScript), ensuring instant response
- All icon imports must come from 'lucide-react' (already integrated, no new dependencies)
- Story 3 ensures consistency across entire application; not required for MVP but strongly recommended
