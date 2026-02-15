# Project Memory: Jupyter To Docx

## Project Goal

Allow the user to export a Jupyter notebook file as a Word Doc or a PDF.

## Constraints & Requirements

- **No External Tools**: The extension should not require the user to install external tools (like Pandoc or LaTeX) to generate the Word Doc or PDF. It should be self-contained or use lightweight JS libraries.
- **UI**: Add a button to the "Editor Bottom" (Status Bar or similar location in VS Code context) which, when pressed, opens a prompt for the user to choose the export format.
- **Output Location**: Exports should be saved to `{project-root}/docs/jupyter-notebook`.

## Active Tasks

### Completed

- [x] **Project Initialization**: Setup repo, `package.json`, and `src` structure.
- [x] **Core Logic**: Implemented `.ipynb` parser and generators for `.docx` and `.pdf`.
- [x] **UI Integration**: Added Status Bar item and "Export Notebook" command.
- [x] **Verification**: Created sample notebook and verified export functionality manually.

### Next Steps

- [ ] **Markdown Formatting**: Improve `DocxGenerator` and `PdfGenerator` to render markdown syntax (bold, italic, headers, lists) instead of raw text.
- [ ] **Image Support**: Implement extraction and embedding of base64 images from notebook outputs into `.docx` and `.pdf`.
- [ ] **Styling Configuration**: Add VS Code settings for font sizes, margins, and code block styles.
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

- **2026-02-15**: Implemented core export logic (Parser, DocxGenerator, PdfGenerator) and UI integration. Added `docx` and `pdf-lib` dependencies.
- **2026-02-15**: Project setup initialized. Created MEMORY.md and docs structure.
