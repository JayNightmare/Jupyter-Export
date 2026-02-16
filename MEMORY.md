# Project Memory: Jupyter Export

## Project Goal

Allow the user to export a Jupyter notebook file as a Word Doc or a PDF.

## Constraints & Requirements

- **No External Tools**: The extension should not require the user to install external tools (like Pandoc or LaTeX) to generate the Word Doc or PDF. It should be self-contained or use lightweight JS libraries.
- **UI**: Add a button to the **Notebook Toolbar** (top right of the editor) which, when pressed, opens a prompt for the user to choose the export format.
- **Output Location**: Exports should be saved to `{project-root}/docs/jupyter-notebook`.

## Active Tasks

### Completed

- [x] **Project Initialization**: Setup repo, `package.json`, and `src` structure.
- [x] **Core Logic**: Implemented `.ipynb` parser and generators for `.docx` and `.pdf`.
- [x] **UI Integration**: Added "Export Notebook" command to the Notebook Toolbar.
- [x] **Verification**: Created sample notebook and verified export functionality manually.
- [x] **Markdown Formatting**: Implemented parsing of Markdown cells using `unified` and `remark-parse`.
- [x] **Image Support**: Implemented embedding of base64 images from notebook outputs.
- [x] **Configuration**: Added VS Code settings for output directory, font family, and font size.

### Next Steps

- [ ] **Verification**: User to manually verify exports with the latest build.
- [ ] **Robust Error Handling**: Improve error messaging for permission overrides and malformed notebooks.

## Architecture

- **Extension Type**: VS Code Extension.
- **Input**: `.ipynb` files (Jupyter Notebooks).
- **Output**: `.docx` (Word), `.pdf` (PDF).
- **Libraries**:
     - `docx` for Word generation.
     - `pdf-lib` for PDF generation.
- **Components**:
     - `NotebookParser`: Parses `.ipynb` JSON content.
     - `DocxGenerator`: Converts parsed data to `.docx`.
     - `PdfGenerator`: Converts parsed data to `.pdf` (simple text wrapping).

## Knowledge & Decisions

- [Status: Completed] Research libraries for .docx generation in JS/TS (Selected: `docx`).
- [Status: Completed] Research libraries for .pdf generation in JS/TS (Selected: `pdf-lib`).
- [Status: Completed] VS Code API for adding buttons to the editor interface (Implemented: `StatusBarItem`).

## History

- **2026-02-16**: Fixed DOCX code block formatting to correctly handle line breaks by splitting content into multiple `TextRun`s.
- **2026-02-16**: Enhanced PDF header styling to match Word document aesthetics (Blue color, specific font sizes, and spacing).
- **2026-02-16**: Fixed PDF export formatting (indented lists, italics support) by enhancing `PdfGenerator` AST traversal and font loading.
- **2026-02-15**: Moved "Export Notebook" button from Status Bar to Notebook Toolbar for better UX.
- **2026-02-15**: Completed Phase 2: Added Markdown formatting (via `unified`/`remark`), Image embedding, and Configuration settings. Fixed compilation issues (Blob/ESM) by updating `tsconfig.json`.
- **2026-02-15**: Implemented core export logic (Parser, DocxGenerator, PdfGenerator) and UI integration. Added `docx` and `pdf-lib` dependencies.
- **2026-02-15**: Project setup initialized. Created MEMORY.md and docs structure.
