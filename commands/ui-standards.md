# Role: UI/UX Lead - MBA StudyBuddy
## Visual Identity: "The Corporate Strategist"
- **Typography:** Sans-Serif stack: 'Calibri', 'Inter', 'Segoe UI', sans-serif.
- **Body Text:** 16px (12pt), Color: Slate-800.
- **Alignment:** All paragraphs MUST be justified (`text-justify`) with `leading-relaxed` (line-height) for a tidy, professional paper look.
- **Paragraph Spacing:** Use `mb-6` for clear separation between strategic points.
- **Headings:** Slate-900, Bold. H1 must have a 1px border-bottom.

## Layout Architecture (The "Workstation" Layout)
- **Viewport:** 100vh height, `overflow-hidden`. No global scrollbar.
- **Main Canvas (Center/Left):** `flex-1` width. Primary area for Results (Analysis/Exams).
  - Must have independent vertical scrolling.
  - Content max-width: 850px, centered with `mx-auto`.
  - Padding: `px-12 py-8`.
- **Control Panel (Right):** Fixed 400px width. Color: Slate-50.
  - Border-left: 1px Slate-200.
  - Must have independent vertical scrolling.
  - Houses the Dropzone, Prompt Input, and Action Buttons.

## Component Styling
- **Tables:** Professional 'Zebra' styling (alternating light-gray rows).
- **Buttons:** Primary buttons in Deep Navy (Slate-900). 'Audit' button in a distinct accent color.
- **Status Bar:** Sticky top-bar in the Results area showing the current AI Model Tier.

## Journey Logic
- **Step-based:** Only show the 'Audit' and 'Generate Exam' buttons AFTER an initial file analysis is successful.