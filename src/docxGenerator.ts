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
	fontFamily: string;
	fontSize: number;
}

export class DocxGenerator {
	private config: GeneratorConfig;

	constructor(
		config: GeneratorConfig = {
			outputDir: "docs/jupyter-notebook",
			fontFamily: "Helvetica",
			fontSize: 12,
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
			paragraphs.push(
				new docx.Paragraph({
					children: this.mapChildrenToRuns(
						node.children || [],
					),
					heading: this.getHeadingLevel(
						node.depth,
					),
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

	private mapChildrenToRuns(nodes: ASTNode[]): docx.ParagraphChild[] {
		const runs: docx.ParagraphChild[] = [];
		for (const node of nodes) {
			if (node.type === "text") {
				runs.push(
					new docx.TextRun({
						text: node.value || "",
					}),
				);
			} else if (node.type === "strong") {
				const children = this.mapChildrenToRuns(
					node.children || [],
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
						}),
					);
				}
			} else if (node.type === "inlineCode") {
				runs.push(
					new docx.TextRun({
						text: node.value || "",
						font: "Courier New",
						color: "C7254E",
						shading: {
							type: docx.ShadingType
								.CLEAR,
							fill: "F9F2F4",
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
		return new docx.Paragraph({
			children: [
				new docx.TextRun({
					text: code,
					font: "Courier New",
					size: 20,
				}),
			],
			spacing: { after: 200 },
			shading: {
				type: docx.ShadingType.CLEAR,
				fill: "F0F0F0",
			},
		});
	}

	private createOutputParagraph(text: string): docx.Paragraph {
		return new docx.Paragraph({
			children: [
				new docx.TextRun({
					text: text,
					font: "Courier New",
					size: 18,
					color: "555555",
				}),
			],
			spacing: { after: 200 },
		});
	}
}
