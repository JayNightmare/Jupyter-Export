import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { NotebookParser } from "./notebookParser";
import { DocxGenerator } from "./docxGenerator";
import { PdfGenerator } from "./pdfGenerator";

export function activate(context: vscode.ExtensionContext) {
	console.log("Jupyter To Docx is now active!");

	// Status Bar Item
	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100,
	);
	statusBarItem.command = "jupyterToDocx.export";
	statusBarItem.text = "$(export) Export Notebook";
	context.subscriptions.push(statusBarItem);

	// Update status bar visibility
	const updateStatusBar = () => {
		const editor = vscode.window.activeNotebookEditor;
		if (editor) {
			statusBarItem.show();
		} else {
			const activeEditor = vscode.window.activeTextEditor;
			if (
				activeEditor &&
				activeEditor.document.languageId ===
					"jupyter-notebook"
			) {
				// Keep it visible if text editor is opening a notebook (raw json)
				statusBarItem.show();
			} else {
				statusBarItem.hide();
			}
		}
	};

	context.subscriptions.push(
		vscode.window.onDidChangeActiveNotebookEditor(updateStatusBar),
	);
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
	);
	updateStatusBar();

	// Register Command
	const exportCommand = vscode.commands.registerCommand(
		"jupyterToDocx.export",
		async () => {
			const editor = vscode.window.activeNotebookEditor;
			let document:
				| vscode.NotebookDocument
				| vscode.TextDocument
				| undefined;

			if (editor) {
				document = editor.notebook;
			} else {
				// Fallback to text editor if valid JSON
				const activeEditor =
					vscode.window.activeTextEditor;
				if (
					activeEditor &&
					activeEditor.document.languageId ===
						"jupyter-notebook"
				) {
					// But wait, parsing raw text document as notebook might be tricky if it's not opened as notebook.
					// However, the parser expects JSON string, so text document is fine.
					document = activeEditor.document;
				}
			}

			if (!document) {
				vscode.window.showErrorMessage(
					"No active Jupyter Notebook found.",
				);
				return;
			}

			// Prompt for format
			const format = await vscode.window.showQuickPick(
				["Word (.docx)", "PDF (.pdf)"],
				{
					placeHolder: "Select export format",
				},
			);

			if (!format) {
				return;
			}

			try {
				await vscode.window.withProgress(
					{
						location: vscode
							.ProgressLocation
							.Notification,
						title: `Exporting to ${format}...`,
						cancellable: false,
					},
					async (progress) => {
						// Get content
						let content = "";
						// Type guard or cast
						if ("cells" in document!) {
							// vscode.NotebookDocument
							// This is tricky. NotebookDocument gives cells, but our parser expects raw JSON string.
							// We can reconstruct JSON from cells, or read the file from disk if it's saved.
							// Reading from disk is safer for now to get the exact JSON structure.
							if (
								document.uri
									.scheme ===
								"file"
							) {
								content =
									fs.readFileSync(
										document
											.uri
											.fsPath,
										"utf8",
									);
							} else {
								throw new Error(
									"Can only export saved files.",
								);
							}
						} else {
							// vscode.TextDocument
							content = (
								document as vscode.TextDocument
							).getText();
						}

						const parser =
							new NotebookParser();
						const data =
							parser.parse(content);

						// Read configuration
						const config =
							vscode.workspace.getConfiguration(
								"jupyterToDocx",
							);
						const outputDirConfig =
							config.get<string>(
								"outputDir",
							) ||
							"docs/jupyter-notebook";
						const fontFamily =
							config.get<string>(
								"fontFamily",
							) || "Helvetica";
						const fontSize =
							config.get<number>(
								"fontSize",
							) || 12;

						const generatorConfig = {
							outputDir: outputDirConfig,
							fontFamily,
							fontSize,
						};

						let buffer: Uint8Array;
						let extension = "";

						if (format === "Word (.docx)") {
							const generator =
								new DocxGenerator(
									generatorConfig,
								);
							const result =
								await generator.generate(
									data,
								);
							buffer =
								result as unknown as Uint8Array;
							extension = "docx";
						} else {
							const generator =
								new PdfGenerator(
									generatorConfig,
								);
							buffer =
								await generator.generate(
									data,
								);
							extension = "pdf";
						}

						// Determine output path
						const workspaceFolder =
							vscode.workspace.getWorkspaceFolder(
								document!.uri,
							);
						let outputDir = "";
						if (workspaceFolder) {
							// Use configured output directory relative to workspace
							outputDir = path.join(
								workspaceFolder
									.uri
									.fsPath,
								outputDirConfig,
							);
						} else {
							// Fallback to same directory
							outputDir =
								path.dirname(
									document!
										.uri
										.fsPath,
								);
						}

						if (!fs.existsSync(outputDir)) {
							fs.mkdirSync(
								outputDir,
								{
									recursive: true,
								},
							);
						}

						const filename = path.basename(
							document!.uri.fsPath,
							path.extname(
								document!.uri
									.fsPath,
							),
						);
						const outputPath = path.join(
							outputDir,
							`${filename}.${extension}`,
						);

						fs.writeFileSync(
							outputPath,
							buffer,
						);

						vscode.window
							.showInformationMessage(
								`Exported to ${outputPath}`,
								"Open",
							)
							.then((selection) => {
								if (
									selection ===
									"Open"
								) {
									vscode.env.openExternal(
										vscode.Uri.file(
											outputPath,
										),
									);
								}
							});
					},
				);
			} catch (error) {
				vscode.window.showErrorMessage(
					`Export failed: ${error}`,
				);
			}
		},
	);

	context.subscriptions.push(exportCommand);
}

export function deactivate() {}
