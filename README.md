<div align="center">

<img src="src/media/icon.png" width="100" height="100">

# Jupyter Export

Export your Jupyter Notebooks (`.ipynb`) to professional Word Documents (`.docx`) and PDFs (`.pdf`) directly from VS Code.

</div>

## Features

- **No External Dependencies**: Works out of the box without installing Pandoc, LaTeX, or other system tools.
- **Seamless Integration**: accessible directly from the Notebook Toolbar or Command Palette.
- **Rich Content Support**:
     - Markdown cells (headings, lists, bold, italic, etc.)
     - Code blocks with syntax highlighting preservation (text-based)
     - Output images (Matplotlib, etc.) embedded directly
     - Tables

## Usage

1. Open a Jupyter Notebook (`.ipynb`).
2. Click the **Export** icon in the Notebook Toolbar (top right).
3. Or, run the command **"Jupyter Export: Export to Word/PDF"** from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
4. Select your desired format: **Word (.docx)** or **PDF (.pdf)**.
5. The exported file will be saved to your configured output directory (default: `docs/jupyter-notebook` within your workspace).

## Extension Settings

This extension contributes the following settings:

- `jupyterExport.outputDir`: Relative path to the folder where exported files will be saved. Default: `docs/jupyter-notebook`.
- `jupyterExport.fontFamily`: Font family to use for PDF exports. Options: `Helvetica`, `Times-Roman`, `Courier`. Default: `Helvetica`.
- `jupyterExport.fontSize`: Base font size for the exported document. Default: `12`.

## Requirements

None! This extension bundles all necessary logic to generate documents.

## Known Issues

- Complex LaTeX math equations may have limited rendering support in this version.
- Interactive widget outputs are static.

## Release Notes

### 0.0.1

- Initial release.
- Support for .docx and .pdf export.
