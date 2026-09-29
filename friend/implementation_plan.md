# Implementation Plan - Subject Sections & Question Ranges Analytics

This plan details the addition of **Subject Sections & Question Range Creation** for **Weekly Tests** and **Mock Tests**, along with section-wise navigation in the student exam interface and 3 subject-wise pie chart analytics in ERP test reports.

---

## 1. Overview of Proposed Features

### A. Admin Test Creation (Weekly & Mock Tests)
- When **Weekly Test** or **Mock Test** is selected in test creation (both Word/PDF AI generator & Manual test creation):
- Render a **Subject Sections & Question Ranges** configuration block matching the design:
  - Dropdown select for Subject Name (populated from standard subjects like *History, Geography, Economy, Polity, Science, Mathematics, Environment, Current Affairs, etc.* + custom option).
  - Range inputs: `From Q#:` (e.g., 1) `TO` `To Q#:` (e.g., 25).
  - Action buttons: `+ Add Subject Section` / `+ Add Another Subject Section` and Trash icon to remove a section.
  - Auto-calculation badge: e.g. `Section 1 (25 Questions)`.
- Save `subjectRanges: [{ subject: "History", startQ: 1, endQ: 25 }, ...]` in backend test record.

### B. Student Test Portal (Live Exam Taking View)
- When a student takes a test with defined subject sections:
- Display a **Section Switcher Bar** above the exam question panel (e.g. `[ All ] [ History (Q1-25) ] [ Geography (Q26-50) ] [ Economy (Q51-75) ]`).
- Section tabs jump directly to the start of that subject range or filter the question palette view.
- Question Palette badges highlight section headers (e.g., `History`, `Geography`) for clear visual categorization.

### C. Student Test Review Modal
- When reviewing a completed attempt, present a **Subject Breakdown Table** displaying per-subject correct, wrong, skipped, marks obtained, and percentage score.

### D. Admin ERP Analytics & Test Reports (3 Pie Charts)
- Under **Test Results & Leaderboards** in ERP:
- For tests with `subjectRanges`, calculate and display **3 Interactive Pie Charts / Visual Analytics**:
  1. **Subject Average Score (%) Pie Chart**: Average percentage score achieved by students per subject (e.g., *History 78%, Geography 62%, Economy 84%*).
  2. **Subject Question Attempt Rate (%) Pie Chart**: Percentage of questions attempted vs skipped within each subject.
  3. **Relative Subject Attempt Distribution Pie Chart (Sums to 100%)**: Proportional breakdown of total attempted questions across subjects (e.g., *History 20%, Geography 50%, Maths 30%*).

---

## Proposed Changes

### Component 1: Admin Test Creation Forms

#### [MODIFY] [web_portal/App.tsx](file:///b:/NERMAI_AFTER_CQO_LAPTOP_DEAD/NERMAI_IAS_ACADEMY/web_portal/App.tsx)
- Add state for `subjectRanges` in both `newTest` and `newPdfTest` state definitions.
- Implement `SubjectSectionsEditor` UI block visible when `testType === 'weekly' || testType === 'mock'`.
- Include `subjectRanges` in API payloads for `/test-portal/test-creation`.

---

### Component 2: Student Examination Interface

#### [MODIFY] [web_portal/App.tsx](file:///b:/NERMAI_AFTER_CQO_LAPTOP_DEAD/NERMAI_IAS_ACADEMY/web_portal/App.tsx)
- Render `SectionSwitcherBar` when taking a test with `activeAttempt.subjectRanges`.
- Group questions by section in the side/bottom Question Palette navigator.

---

### Component 3: ERP Analytics & Reports

#### [MODIFY] [web_portal/App.tsx](file:///b:/NERMAI_AFTER_CQO_LAPTOP_DEAD/NERMAI_IAS_ACADEMY/web_portal/App.tsx)
- Calculate aggregated subject-wise metrics across test participants.
- Render SVG Donut/Pie Charts for all 3 analytical dimensions.

---

## Verification Plan

### Automated Verification
- Verify backend TypeScript build: `npx tsc --noEmit` in `backend`.

### Manual Verification
1. Create a Mock Test with 2 Subject Sections (e.g., History Q1-2, Economy Q3-4).
2. Take the test as a student; verify Section tabs (`History`, `Economy`) and question jumping.
3. Submit test and verify Subject Breakdown table in Student Review.
4. View test analytics in ERP Results panel; verify all 3 Subject Pie Charts render properly.
