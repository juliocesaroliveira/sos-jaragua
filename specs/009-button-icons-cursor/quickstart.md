# Quickstart Validation Guide

**Feature**: Unified Button Icons and Cursor Feedback

**Purpose**: Validate end-to-end that buttons display icons and provide cursor feedback

---

## Prerequisites

- Development environment set up (Node.js, npm)
- Application running locally (`npm run dev`)
- Browser with developer tools open (F12)
- Access to the SOS Jaraguá application UI

---

## Validation Scenario 1: Button Cursor Feedback on Hover

**Goal**: Verify that enabled buttons show pointer cursor on hover

**Steps**:

1. Start the development server:

    ```bash
    npm run dev
    ```

    Wait for compilation to complete.

2. Open the application in browser (typically `http://localhost:3000`)

3. Navigate to any page with interactive buttons (e.g., User Management page at `/app/admin/users`)

4. Open browser Developer Tools (F12) → Elements tab

5. Locate any enabled button element in the DOM

6. Hover your mouse over the button

7. **Expected Result**:
    - Visual cursor changes to pointer (hand icon)
    - CSS class `hover:cursor-pointer` is present in button's className
    - Button background color changes per variant (hover effect)

8. Move mouse away from button

9. **Expected Result**:
    - Cursor reverts to default arrow
    - Button returns to normal state

**Pass Criteria**: ✓ Pointer cursor appears on hover; reverts on mouse leave

---

## Validation Scenario 2: Icon Display on Enabled Buttons

**Goal**: Verify that buttons display semantic icons on the left side

**Steps**:

1. Application is running (from Scenario 1)

2. Navigate to the User Management page (`/app/admin/users` or similar admin panel)

3. Locate action buttons in the page (Create User, Edit, Delete buttons, etc.)

4. **Expected Result**:
    - Each button displays an icon to the LEFT of the text
    - Icon visually matches the button action:
        - "Criar Usuário" → Plus icon
        - "Editar" → Pencil icon
        - "Deletar" → Trash icon
    - Icons are properly sized and aligned with text

5. Inspect button element in Developer Tools

6. Verify `iconeInicio` prop is rendered (look for icon component in React tree)

**Pass Criteria**: ✓ All action buttons display appropriate left-aligned icons

---

## Validation Scenario 3: Disabled Button Cursor Behavior

**Goal**: Verify that disabled buttons show not-allowed cursor, NOT pointer

**Steps**:

1. Application is running (from Scenario 1)

2. Navigate to a page with a disabled button
    - Example: Submit button before required fields are filled
    - Or: A disabled action button in the user list (if editing is disabled for some users)

3. Hover your mouse over the disabled button

4. **Expected Result**:
    - Cursor shows "not-allowed" symbol (circle with slash)
    - NOT pointer cursor
    - Button appears faded/disabled (lower opacity)

5. Inspect disabled button element in Developer Tools

6. Verify CSS classes include `disabled:cursor-not-allowed`

**Pass Criteria**: ✓ Disabled button shows not-allowed cursor, not pointer

---

## Validation Scenario 4: Icon-Only Buttons (if any exist)

**Goal**: Verify that buttons with only an icon (no text) still display the icon and cursor feedback

**Steps**:

1. Application is running (from Scenario 1)

2. Look for icon-only buttons in the UI
    - Example: Close/minimize buttons, compact action buttons in data tables
    - If none exist, this scenario is N/A

3. Hover over an icon-only button

4. **Expected Result**:
    - Icon is displayed and visible
    - Pointer cursor appears on hover
    - Button is clearly clickable

5. Inspect icon-only button in Developer Tools

6. Verify icon renders even with no text children

**Pass Criteria**: ✓ Icon-only buttons display icon and cursor feedback (if applicable)

---

## Validation Scenario 5: Loading State Button Cursor

**Goal**: Verify that loading buttons show not-allowed cursor (disabled state)

**Steps**:

1. Application is running (from Scenario 1)

2. Navigate to a form or page with a submit button

3. Trigger a form submission (click submit button)

4. While submission is in progress, hover over the submit button

5. **Expected Result**:
    - Cursor shows "not-allowed" symbol (button is disabled during loading)
    - Loading spinner is visible (replaces start icon)
    - Button text is still visible (layout doesn't collapse)

6. Inspect button element in Developer Tools

7. Verify `disabled:cursor-not-allowed` class is applied

**Pass Criteria**: ✓ Loading button shows not-allowed cursor; layout is stable

---

## Validation Scenario 6: Button Variants with Icons

**Goal**: Verify that all button variants (primary, secondary, ghost, danger) display icons consistently

**Steps**:

1. Application is running (from Scenario 1)

2. Find buttons of different variants on the page:
    - Primary button (solid background) with icon
    - Secondary button (border/surface) with icon
    - Ghost button (minimal styling) with icon
    - Danger button (red) with icon

3. For each variant:
    - Hover over the button
    - Verify pointer cursor appears
    - Verify icon is visible and left-aligned
    - Verify button styling matches variant design

4. Inspect each button's className in Developer Tools

5. Verify all variants include cursor utilities and icon slots

**Pass Criteria**: ✓ All button variants display icons and cursor feedback consistently

---

## Validation Scenario 7: Cursor Feedback Performance

**Goal**: Verify that cursor feedback responds without lag

**Steps**:

1. Application is running (from Scenario 1)

2. Open browser Developer Tools → Performance tab

3. Click the record button

4. Hover over multiple buttons rapidly (5-10 times)

5. Stop the recording

6. **Expected Result**:
    - Cursor change is instant (< 50ms latency)
    - No layout shifts or reflows triggered by cursor change
    - No JavaScript execution time > 50ms for cursor feedback

7. Timeline should show minimal activity for hover events

**Pass Criteria**: ✓ Cursor feedback is imperceptible (< 50ms); no performance regression

---

## Validation Scenario 8: Mobile Responsiveness (Touch Devices)

**Goal**: Verify that buttons remain functional and icons display on mobile

**Steps**:

1. Application is running (from Scenario 1)

2. Open browser DevTools → Device toolbar (toggle to mobile view)

3. Select a mobile device profile (e.g., iPhone 12)

4. Navigate to a page with buttons (User Management or similar)

5. **Expected Result**:
    - Icons are displayed on the left side of button text
    - Buttons are touch-enabled and respond to taps
    - Buttons are appropriately sized for mobile (min 44x44px recommended)
    - Text is readable without zooming

6. Tap on a button

7. **Expected Result**:
    - Button click event fires correctly
    - Navigation or action completes as expected

**Pass Criteria**: ✓ Icons display on mobile; buttons are touch-responsive; text is readable

---

## Validation Scenario 9: Accessibility - Keyboard Navigation

**Goal**: Verify that buttons with icons are keyboard-navigable and screen-reader-friendly

**Steps**:

1. Application is running (from Scenario 1)

2. Open a page with buttons (User Management)

3. Press `Tab` key to navigate through interactive elements

4. **Expected Result**:
    - Focus moves to button
    - Visual focus ring is visible (ANEL_FOCO styling)
    - Button text is readable and clear

5. Press `Enter` or `Space` while focused on button

6. **Expected Result**:
    - Button click event fires
    - Action completes as expected

7. (Optional) Enable screen reader (Windows: Narrator, macOS: VoiceOver)

8. **Expected Result**:
    - Screen reader announces button text and role
    - Button action is clear from text alone (icon is not announced, which is correct if decorative)

**Pass Criteria**: ✓ Buttons are keyboard-navigable; focus is visible; screen reader compatibility maintained

---

## Automated Test Validation

**Vitest Unit Tests**:

Run component tests to verify implementation:

```bash
npm test -- button.test.tsx
```

**Expected Test Output**:

- ✓ Button renders with cursor-pointer class
- ✓ Button renders iconeInicio when provided
- ✓ Disabled button has cursor-not-allowed class
- ✓ All button variants apply icons and cursor styles
- ✓ Loading state shows spinner, hides iconeInicio
- ✓ Button maintains accessibility attributes (aria-busy, etc.)

**Browser Compatibility Tests**:

Run in multiple browsers (via CI or manual):

- Chrome/Edge (Chromium)
- Firefox
- Safari

**Expected Result**: Cursor feedback and icon display work identically across browsers

---

## Rollback Criteria

If any of the above scenarios fail, this indicates the feature is not ready for production:

1. **Cursor not changing on hover**: CSS classes not applied; check button component className composition
2. **Icons not displaying**: Icon prop not passed or icon source not imported; check button usages
3. **Disabled button shows pointer**: CSS class override; check Tailwind specificity and class order
4. **Performance lag**: Unnecessary re-renders or heavy operations on hover; profile and optimize
5. **Accessibility issues**: Focus ring missing or screen reader doesn't announce button; verify ANEL_FOCO and aria attributes
6. **Mobile breakage**: Icons overflow or buttons too small; verify responsive sizing and spacing

---

## Success Criteria Summary

Feature is production-ready when:

- ✅ All 9 scenarios pass
- ✅ Vitest tests pass
- ✅ Browser compatibility verified (Chrome, Firefox, Safari)
- ✅ No accessibility regressions
- ✅ No performance regressions (< 50ms cursor feedback)
- ✅ 100% of button instances have appropriate icons
- ✅ Code review approved
