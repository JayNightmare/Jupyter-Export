/* eslint-disable curly */
import * as docx from "docx";
import { NotebookData } from "./notebookParser";

// Define AST interfaces locally to avoid complex type deps if not installing @types/mdast
interface ASTNode {
	type: string;
	children?: ASTNode[];
	value?: string;
	depth?: number;
	ordered?: boolean;
	url?: string;
	urlSource?: string; // custom
}

export interface GeneratorConfig {
	outputDir: string;
	word: {
		heading1: {
			fontFamily: string;
			fontSize: number;
			color: string;
		};
		heading2: {
			fontFamily: string;
			fontSize: number;
			color: string;
		};
		heading3: {
			fontFamily: string;
			fontSize: number;
			color: string;
		};
		body: { fontFamily: string; fontSize: number; color: string };
		code: {
			fontFamily: string;
			fontSize: number;
			backgroundColor: string;
			color: string;
		};
	};
}

export class DocxGenerator {
	private config: GeneratorConfig;

	constructor(
		config: GeneratorConfig = {
			outputDir: "docs/jupyter-notebook",
			word: {
				heading1: {
					fontFamily: "Helvetica",
					fontSize: 24,
					color: "000000",
				},
				heading2: {
					fontFamily: "Helvetica",
					fontSize: 18,
					color: "000000",
				},
				heading3: {
					fontFamily: "Helvetica",
					fontSize: 14,
					color: "000000",
				},
				body: {
					fontFamily: "Helvetica",
					fontSize: 12,
					color: "000000",
				},
				code: {
					fontFamily: "Courier New",
					fontSize: 10,
					backgroundColor: "F0F0F0",
					color: "000000",
				},
			},
		},
	) {
		this.config = config;
	}

	public async generate(data: NotebookData): Promise<Buffer> {
		const children: (docx.Paragraph | docx.Table)[] = [];

		for (const cell of data.cells) {
			if (cell.cell_type === "markdown") {
				const paragraphs = await this.processMarkdown(
					cell.source.join(""),
				);
				children.push(...paragraphs);
			} else if (cell.cell_type === "code") {
				children.push(
					this.createCodeParagraph(
						cell.source.join(""),
					),
				);
				if (cell.outputs && cell.outputs.length > 0) {
					for (const output of cell.outputs) {
						if (output.text) {
							children.push(
								this.createOutputParagraph(
									output.text.join(
										"",
									),
								),
							);
						}

						// Image support
						if (output.data) {
							const imageTypes = [
								"image/png",
								"image/jpeg",
								"image/jpg",
							];
							for (const type of imageTypes) {
								if (
									output
										.data[
										type
									]
								) {
									// base64 string
									const base64Data =
										Array.isArray(
											output
												.data[
												type
											],
										)
											? output.data[
													type
												].join(
													"",
												)
											: output
													.data[
													type
												];

									try {
										const buffer =
											Buffer.from(
												base64Data,
												"base64",
											);
										const imageParagraph =
											new docx.Paragraph(
												{
													children: [
														new docx.ImageRun(
															{
																data: buffer,
																transformation:
																	{
																		width: 400,
																		height: 300,
																	},
																type: "png", // explicit type often helps or is required by newer docx
															} as any,
														), // Casting as any to bypass strict type check for now if version mismatch
													],
												},
											);
										children.push(
											imageParagraph,
										);
									} catch (e) {
										console.error(
											"Failed to embed image",
											e,
										);
									}
								}
							}
						}
					}
				}
			}
		}

		const doc = new docx.Document({
			sections: [
				{
					properties: {},
					children: children,
				},
			],
		});

		return docx.Packer.toBuffer(doc);
	}

	private async processMarkdown(text: string): Promise<docx.Paragraph[]> {
		const { unified } = await import("unified");
		const remarkParse = await import("remark-parse");

		// remarkParse.default because it might be a module with default export
		const processor = unified().use(remarkParse.default as any);
		const ast = processor.parse(text) as unknown as ASTNode;
		return this.mapAstToDocx(ast);
	}

	private mapAstToDocx(node: ASTNode): docx.Paragraph[] {
		const paragraphs: docx.Paragraph[] = [];

		if (node.type === "root" && node.children) {
			for (const child of node.children) {
				paragraphs.push(...this.mapAstToDocx(child));
			}
		} else if (node.type === "paragraph") {
			paragraphs.push(
				new docx.Paragraph({
					children: this.mapChildrenToRuns(
						node.children || [],
					),
				}),
			);
		} else if (node.type === "heading") {
			const level = this.getHeadingLevel(node.depth);
			let style = this.config.word.heading1;
			if (node.depth === 2) style = this.config.word.heading2;
			if (node.depth === 3) style = this.config.word.heading3;

			paragraphs.push(
				new docx.Paragraph({
					children: this.mapChildrenToRuns(
						node.children || [],
						style,
					),
					heading: level,
					spacing: { before: 200, after: 100 },
				}),
			);
		} else if (node.type === "list") {
			// Basic list handling using bullet/numbering properties would be better
			// but requires abstract numbering definitions.
			// Simulating with simple text for now or simple paragraphs
			if (node.children) {
				for (const item of node.children) {
					// List item
					const runChildren =
						this.mapChildrenToRuns(
							item.children?.[0]
								?.children ||
								[],
						); // First paragraph of list item
					const bullet = node.ordered
						? `${1}. `
						: "\u2022 "; // Simple manual bullet

					paragraphs.push(
						new docx.Paragraph({
							children: [
								new docx.TextRun(
									{
										text: bullet,
									},
								),
								...runChildren,
							],
							indent: { left: 720 }, // 0.5 inch
						}),
					);
				}
			}
		}

		return paragraphs;
	}

	private mapChildrenToRuns(
		nodes: ASTNode[],
		styleOverride?: {
			fontFamily: string;
			fontSize: number;
			color: string;
		},
	): docx.ParagraphChild[] {
		const style = styleOverride || this.config.word.body;
		const runs: docx.ParagraphChild[] = [];
		for (const node of nodes) {
			if (node.type === "text") {
				runs.push(
					new docx.TextRun({
						text: node.value || "",
						font: style.fontFamily,
						size: style.fontSize * 2, // docx uses half-points
						color: style.color,
					}),
				);
			} else if (node.type === "strong") {
				const children = this.mapChildrenToRuns(
					node.children || [],
					style,
				);
				children.forEach((child) => {
					if (child instanceof docx.TextRun) {
						// Cloning isn't easy, so we just create new TextRun
						// Limitation: bolding nested structures is hard without recursion
						// Just toggle bold on text run
						// This is tricky. TextRun is immutable-ish.
						// Better to map to options then create Run.
						// Simplifying: assuming text children only for bold
					}
				});
				// Simplified: just assuming structure is simple text inside strong
				if (
					node.children &&
					node.children[0] &&
					node.children[0].type === "text"
				) {
					runs.push(
						new docx.TextRun({
							text:
								node.children[0]
									.value ||
								"",
							bold: true,
							font: style.fontFamily,
							size:
								style.fontSize *
								2,
							color: style.color,
						}),
					);
				}
			} else if (node.type === "emphasis") {
				if (
					node.children &&
					node.children[0] &&
					node.children[0].type === "text"
				) {
					runs.push(
						new docx.TextRun({
							text:
								node.children[0]
									.value ||
								"",
							italics: true,
							font: style.fontFamily,
							size:
								style.fontSize *
								2,
							color: style.color,
						}),
					);
				}
			} else if (node.type === "inlineCode") {
				runs.push(
					new docx.TextRun({
						text: node.value || "",
						font: this.config.word.code
							.fontFamily,
						size:
							this.config.word.code
								.fontSize * 2,
						color: "C7254E", // Bootstrap code color, maybe make configurable later
						shading: {
							type: docx.ShadingType
								.CLEAR,
							fill: this.config.word
								.code
								.backgroundColor,
						},
					}),
				);
			}
		}
		return runs;
	}

	private getHeadingLevel(depth?: number): any {
		switch (depth) {
			case 1:
				return docx.HeadingLevel.HEADING_1;
			case 2:
				return docx.HeadingLevel.HEADING_2;
			case 3:
				return docx.HeadingLevel.HEADING_3;
			case 4:
				return docx.HeadingLevel.HEADING_4;
			default:
				return docx.HeadingLevel.HEADING_1;
		}
	}

	private createCodeParagraph(code: string): docx.Paragraph {
		const lines = code.split("\n");
		const coloredRuns: docx.TextRun[] = [];

		// Simple keyword list for basic syntax highlighting (Python/JS/TS)
		const keywords = [
			"import",
			"from",
			"def",
			"class",
			"return",
			"if",
			"else",
			"elif",
			"for",
			"while",
			"print",
			"const",
			"let",
			"var",
			"function",
			"async",
			"await",
			"try",
			"catch",
			"finally",
			"public",
			"private",
			"protected",
			"interface",
			"type",
			"module",
			"export",
			"default",
		];
		// Sort by length desc to match longest first if needed, though regex | is usually greedy-ish or order dependant.
		// \b matches word boundaries.
		const keywordRegex = new RegExp(
			`\\b(${keywords.join("|")})\\b`,
			"g",
		);

		lines.forEach((line, index) => {
			// Indentation fix: replace leading spaces with non-breaking spaces
			// Word sometimes eats spaces. NBSP (\u00A0) is rendered visibly.
			// Or we could use tab stops, but text replacement is easier for now.
			// We only replace LEADING spaces to match indentation.
			const leadingSpacesMatch = line.match(/^ */);
			const leadingSpacesCount = leadingSpacesMatch
				? leadingSpacesMatch[0].length
				: 0;
			const indentation = "\u00A0".repeat(leadingSpacesCount);
			const trimmedContent =
				line.substring(leadingSpacesCount);

			// If line is just spaces
			if (trimmedContent.length === 0) {
				// Just an empty line with potentially ignored spaces
				coloredRuns.push(
					new docx.TextRun({
						text: "",
						break: index > 0 ? 1 : 0,
						font: this.config.word.code
							.fontFamily,
						size:
							this.config.word.code
								.fontSize * 2,
					}),
				);
				return;
			}

			// Process content for keywords
			let lastIndex = 0;
			let match;

			// Reset regex state
			keywordRegex.lastIndex = 0;

			// We need to handle the newline 'break' on the first run of the line
			// Actually, if we pushed an indent run, that handles the break?
			// No, let's put the break on the very first run we push for this line.
			let hasAddedRunForLine = false;

			const addRun = (
				text: string,
				color: string,
				isIndentation = false,
			) => {
				if (text.length === 0) return;

				coloredRuns.push(
					new docx.TextRun({
						text: text,
						font: this.config.word.code
							.fontFamily,
						size:
							this.config.word.code
								.fontSize * 2,
						color: color,
						break:
							!hasAddedRunForLine &&
							index > 0
								? 1
								: 0,
					}),
				);
				hasAddedRunForLine = true;
			};

			// Add indentation run
			if (indentation.length > 0) {
				addRun(
					indentation,
					this.config.word.code.color || "000000",
					true,
				);
			}

			while (
				(match = keywordRegex.exec(trimmedContent)) !==
				null
			) {
				// Text before match
				const before = trimmedContent.substring(
					lastIndex,
					match.index,
				);
				addRun(
					before,
					this.config.word.code.color || "000000",
				); // Default color

				// Keyword match
				addRun(match[0], "0000FF"); // Blue for keywords

				lastIndex = keywordRegex.lastIndex;
			}

			// Remaining text
			const remaining = trimmedContent.substring(lastIndex);
			addRun(
				remaining,
				this.config.word.code.color || "000000",
			);

			// If nothing was added (empty line was handled above, but just in case)
			if (!hasAddedRunForLine) {
				// Force a run to ensure line break exists
				coloredRuns.push(
					new docx.TextRun({
						text: "",
						break: index > 0 ? 1 : 0,
						font: this.config.word.code
							.fontFamily,
						size:
							this.config.word.code
								.fontSize * 2,
					}),
				);
			}
		});

		return new docx.Paragraph({
			children: coloredRuns,
			spacing: { after: 200 },
			shading: {
				type: docx.ShadingType.CLEAR,
				fill: this.config.word.code.backgroundColor,
			},
		});
	}

	private createOutputParagraph(text: string): docx.Paragraph {
		const lines = text.split("\n");
		const runs: docx.TextRun[] = [];

		lines.forEach((line, index) => {
			// Indentation fix: replace leading spaces with non-breaking spaces
			const leadingSpacesMatch = line.match(/^ */);
			const leadingSpacesCount = leadingSpacesMatch
				? leadingSpacesMatch[0].length
				: 0;
			const indentation = "\u00A0".repeat(leadingSpacesCount);
			const trimmedContent =
				line.substring(leadingSpacesCount);

			const needsBreak = index > 0 ? 1 : 0;

			// If line is just spaces/empty
			if (trimmedContent.length === 0) {
				runs.push(
					new docx.TextRun({
						text: "",
						break: needsBreak,
						font: "Courier New",
						size: 18,
					}),
				);
				return;
			}

			// Add indentation if present
			if (indentation) {
				runs.push(
					new docx.TextRun({
						text: indentation,
						font: "Courier New",
						size: 18, // 9pt
						color: "555555",
						break: needsBreak,
					}),
				);
				// Add content without break (already handled by indentation run)
				if (trimmedContent) {
					runs.push(
						new docx.TextRun({
							text: trimmedContent,
							font: "Courier New",
							size: 18, // 9pt
							color: "555555",
						}),
					);
				}
			} else {
				// No indent, just content
				runs.push(
					new docx.TextRun({
						text: trimmedContent,
						font: "Courier New",
						size: 18, // 9pt
						color: "555555",
						break: needsBreak,
					}),
				);
			}
		});

		return new docx.Paragraph({
			children: runs,
			spacing: { after: 200 },
			// Minimal shading for output to distinguish it? User didn't ask, but standard is often greyish or none.
			// Leaving as none.
		});
	}
}
