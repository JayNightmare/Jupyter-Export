import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { NotebookParser } from "./notebookParser";
import { DocxGenerator } from "./docxGenerator";
import { PdfGenerator } from "./pdfGenerator";
import { SettingsWebview } from "./settingsWebview";

export function activate(context: vscode.ExtensionContext) {
	console.log("Jupyter Export is now active!");

	// Register Command
	const exportCommand = vscode.commands.registerCommand(
		"jupyterExport.export",
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
						if (
							"notebookType" in
							document!
						) {
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
								"jupyterExport",
							);
						const outputDirConfig =
							config.get<string>(
								"outputDir",
							) ||
							"docs/jupyter-notebook";

						const getCfg = (
							section: string,
							key: string,
							defaultVal: any,
						) =>
							config.get(
								`${section}.${key}`,
							) || defaultVal;

						const generatorConfig = {
							outputDir: outputDirConfig,
							word: {
								heading1: {
									fontFamily:
										(config.get(
											"word.heading1.fontFamily",
										) as string) ||
										"Helvetica",
									fontSize:
										(config.get(
											"word.heading1.fontSize",
										) as number) ||
										24,
									color:
										(config.get(
											"word.heading1.color",
										) as string) ||
										"000000",
								},
								heading2: {
									fontFamily:
										(config.get(
											"word.heading2.fontFamily",
										) as string) ||
										"Helvetica",
									fontSize:
										(config.get(
											"word.heading2.fontSize",
										) as number) ||
										18,
									color:
										(config.get(
											"word.heading2.color",
										) as string) ||
										"000000",
								},
								heading3: {
									fontFamily:
										(config.get(
											"word.heading3.fontFamily",
										) as string) ||
										"Helvetica",
									fontSize:
										(config.get(
											"word.heading3.fontSize",
										) as number) ||
										14,
									color:
										(config.get(
											"word.heading3.color",
										) as string) ||
										"000000",
								},
								body: {
									fontFamily:
										(config.get(
											"word.body.fontFamily",
										) as string) ||
										"Helvetica",
									fontSize:
										(config.get(
											"word.body.fontSize",
										) as number) ||
										12,
									color:
										(config.get(
											"word.body.color",
										) as string) ||
										"000000",
								},
								code: {
									fontFamily:
										(config.get(
											"word.code.fontFamily",
										) as string) ||
										"Courier New",
									fontSize:
										(config.get(
											"word.code.fontSize",
										) as number) ||
										10,
									backgroundColor:
										(config.get(
											"word.code.backgroundColor",
										) as string) ||
										"F0F0F0",
									color:
										(config.get(
											"word.code.color",
										) as string) ||
										"000000",
								},
							},
							pdf: {
								heading1: {
									fontFamily:
										(config.get(
											"pdf.heading1.fontFamily",
										) as string) ||
										"Helvetica",
									fontSize:
										(config.get(
											"pdf.heading1.fontSize",
										) as number) ||
										24,
									color:
										(config.get(
											"pdf.heading1.color",
										) as string) ||
										"000000",
								},
								heading2: {
									fontFamily:
										(config.get(
											"pdf.heading2.fontFamily",
										) as string) ||
										"Helvetica",
									fontSize:
										(config.get(
											"pdf.heading2.fontSize",
										) as number) ||
										18,
									color:
										(config.get(
											"pdf.heading2.color",
										) as string) ||
										"000000",
								},
								heading3: {
									fontFamily:
										(config.get(
											"pdf.heading3.fontFamily",
										) as string) ||
										"Helvetica",
									fontSize:
										(config.get(
											"pdf.heading3.fontSize",
										) as number) ||
										14,
									color:
										(config.get(
											"pdf.heading3.color",
										) as string) ||
										"000000",
								},
								body: {
									fontFamily:
										(config.get(
											"pdf.body.fontFamily",
										) as string) ||
										"Helvetica",
									fontSize:
										(config.get(
											"pdf.body.fontSize",
										) as number) ||
										12,
									color:
										(config.get(
											"pdf.body.color",
										) as string) ||
										"000000",
								},
								code: {
									fontFamily:
										(config.get(
											"pdf.code.fontFamily",
										) as string) ||
										"Courier",
									fontSize:
										(config.get(
											"pdf.code.fontSize",
										) as number) ||
										10,
									backgroundColor:
										(config.get(
											"pdf.code.backgroundColor",
										) as string) ||
										"F0F0F0",
									color:
										(config.get(
											"pdf.code.color",
										) as string) ||
										"000000",
								},
							},
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

	const exportStylingCommand = vscode.commands.registerCommand(
		"jupyterExport.exportStyling",
		() => {
			SettingsWebview.createOrShow(context.extensionUri);
		},
	);

	context.subscriptions.push(exportStylingCommand);
}

export function deactivate() {}
