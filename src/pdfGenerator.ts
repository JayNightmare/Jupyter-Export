import {
	PDFDocument,
	StandardFonts,
	rgb,
	PDFFont,
	PDFPage,
	PDFImage,
	Color,
} from "pdf-lib";
import { NotebookData } from "./notebookParser";

interface ASTNode {
	type: string;
	children?: ASTNode[];
	value?: string;
	depth?: number;
	ordered?: boolean;
}

export interface GeneratorConfig {
	outputDir: string;
	fontFamily: string;
	fontSize: number;
}

export class PdfGenerator {
	private config: GeneratorConfig;
	private pdfDoc!: PDFDocument;
	private font!: PDFFont;
	private boldFont!: PDFFont;
	private italicFont!: PDFFont;
	private boldItalicFont!: PDFFont;
	private codeFont!: PDFFont;
	private page!: PDFPage;
	private width!: number;
	private height!: number;
	private y!: number;
	private margin = 50;
	private fontSize = 12; // Will be overwritten by config
	private lineHeight = 14;
	private currentIndent = 0;
	private currentColor: Color = rgb(0, 0, 0);

	constructor(
		config: GeneratorConfig = {
			outputDir: "docs/jupyter-notebook",
			fontFamily: "Helvetica",
			fontSize: 12,
		},
	) {
		this.config = config;
		this.fontSize = config.fontSize;
		this.lineHeight = Math.round(config.fontSize * 1.2);
	}

	public async generate(data: NotebookData): Promise<Uint8Array> {
		this.pdfDoc = await PDFDocument.create();

		switch (this.config.fontFamily) {
			case "Times-Roman":
				this.font = await this.pdfDoc.embedFont(
					StandardFonts.TimesRoman,
				);
				this.boldFont = await this.pdfDoc.embedFont(
					StandardFonts.TimesRomanBold,
				);
				this.italicFont = await this.pdfDoc.embedFont(
					StandardFonts.TimesRomanItalic,
				);
				this.boldItalicFont =
					await this.pdfDoc.embedFont(
						StandardFonts.TimesRomanBoldItalic,
					);
				break;
			case "Courier":
				this.font = await this.pdfDoc.embedFont(
					StandardFonts.Courier,
				);
				this.boldFont = await this.pdfDoc.embedFont(
					StandardFonts.CourierBold,
				);
				this.italicFont = await this.pdfDoc.embedFont(
					StandardFonts.CourierOblique,
				);
				this.boldItalicFont =
					await this.pdfDoc.embedFont(
						StandardFonts.CourierBoldOblique,
					);
				break;
			case "Helvetica":
			default:
				this.font = await this.pdfDoc.embedFont(
					StandardFonts.Helvetica,
				);
				this.boldFont = await this.pdfDoc.embedFont(
					StandardFonts.HelveticaBold,
				);
				this.italicFont = await this.pdfDoc.embedFont(
					StandardFonts.HelveticaOblique,
				);
				this.boldItalicFont =
					await this.pdfDoc.embedFont(
						StandardFonts.HelveticaBoldOblique,
					);
				break;
		}

		this.codeFont = await this.pdfDoc.embedFont(
			StandardFonts.Courier,
		);

		this.addPage();

		for (const cell of data.cells) {
			if (cell.cell_type === "markdown") {
				await this.processMarkdown(
					cell.source.join(""),
				);
			} else if (cell.cell_type === "code") {
				this.drawText(cell.source.join(""), {
					isCode: true,
				});
				this.y -= 10;

				if (cell.outputs) {
					for (const output of cell.outputs) {
						if (output.text) {
							this.drawText(
								output.text.join(
									"",
								),
								{
									isCode: true,
								},
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
										let image: PDFImage;
										if (
											type.includes(
												"png",
											)
										) {
											image =
												await this.pdfDoc.embedPng(
													buffer,
												);
										} else {
											image =
												await this.pdfDoc.embedJpg(
													buffer,
												);
										}
										this.drawImage(
											image,
										);
									} catch (e) {
										console.error(
											"Failed to embed PDF image",
											e,
										);
									}
								}
							}
						}
					}
					this.y -= 10;
				}
			}
		}

		return this.pdfDoc.save();
	}

	private addPage() {
		this.page = this.pdfDoc.addPage();
		const { width, height } = this.page.getSize();
		this.width = width;
		this.height = height;
		this.y = height - this.margin;
	}

	private checkPageBreak(neededHeight: number = 0) {
		if (this.y - neededHeight < this.margin) {
			this.addPage();
		}
	}

	private async processMarkdown(text: string) {
		const { unified } = await import("unified");
		const remarkParse = await import("remark-parse");

		const processor = unified().use(remarkParse.default as any);
		const ast = processor.parse(text) as unknown as ASTNode;
		return this.processAst(ast);
	}

	private processAst(node: ASTNode) {
		if (node.type === "root" && node.children) {
			for (const child of node.children) {
				this.processAst(child);
			}
		} else if (node.type === "paragraph") {
			if (node.children) {
				// Flatten children to text runs for simpler wrapping
				// This is a simplification. Ideally check children types.
				this.drawRuns(node.children);
				this.y -= this.lineHeight / 2;
			}
		} else if (node.type === "heading") {
			const depth = node.depth || 1;
			const oldSize = this.fontSize;
			const oldColor = this.currentColor;

			// Word-like styling
			let spacingBefore = 10;
			let spacingAfter = 10;

			switch (depth) {
				case 1:
					this.fontSize = 24;
					this.currentColor = rgb(
						0.18,
						0.33,
						0.59,
					); // Dark Blue #2F5496
					spacingBefore = 20;
					spacingAfter = 10;
					break;
				case 2:
					this.fontSize = 18;
					this.currentColor = rgb(
						0.18,
						0.33,
						0.59,
					); // Dark Blue #2F5496
					spacingBefore = 16;
					spacingAfter = 10;
					break;
				case 3:
					this.fontSize = 14;
					this.currentColor = rgb(
						0.12,
						0.22,
						0.39,
					); // Darker Blue #1F3763
					spacingBefore = 14;
					spacingAfter = 10;
					break;
				default:
					this.fontSize = 12;
					this.currentColor = rgb(0, 0, 0); // Black
					spacingBefore = 12;
					spacingAfter = 10;
					break;
			}

			// Apply spacing before
			this.y -= spacingBefore;
			this.checkPageBreak(this.fontSize + spacingAfter);

			if (node.children) {
				this.drawRuns(node.children, true);
			}

			this.fontSize = oldSize;
			this.currentColor = oldColor;
			this.y -= spacingAfter;
		} else if (node.type === "list") {
			this.currentIndent += 20;
			if (node.children) {
				for (const item of node.children) {
					// Check for list item
					if (item.type === "listItem") {
						// Draw the bullet point manually before processing the item content
						const bullet = node.ordered
							? "1. "
							: "• ";
						this.page.drawText(bullet, {
							x:
								this.margin +
								this
									.currentIndent -
								15, // Hanging indent for bullet
							y: this.y,
							size: this.fontSize,
							font: this.font,
							color: this
								.currentColor,
						});

						// Process the content of the list item
						if (item.children) {
							for (const child of item.children) {
								this.processAst(
									child,
								);
							}
						}
					}
				}
			}
			this.currentIndent -= 20;
		}
	}

	private drawRuns(nodes: ASTNode[], forceBold: boolean = false) {
		// Collect all text and styles to wrap them properly?
		// Simple approach: Render one by one, manually wrapping?
		// Hard because mixed styles (bold/regular) in one line need to track X position.
		// For iteration 2: Just flatten to plain text for wrapping if complicated,
		// OR implement a basic "Cursor" system.

		let cursorX = this.margin + this.currentIndent;

		// Flatten nodes to words with style
		interface StyledWord {
			text: string;
			font: PDFFont;
		}
		const words: StyledWord[] = [];

		const collectWords = (
			subNodes: ASTNode[],
			isBold: boolean,
			isItalic: boolean,
			isCode: boolean,
		) => {
			for (const node of subNodes) {
				if (node.type === "text") {
					let font = this.font;
					if (isCode) {
						font = this.codeFont;
					} else if (isBold && isItalic) {
						font = this.boldItalicFont;
					} else if (isBold) {
						font = this.boldFont;
					} else if (isItalic) {
						font = this.italicFont;
					}
					const w = (node.value || "").split(" ");
					for (let i = 0; i < w.length; i++) {
						words.push({
							text:
								w[i] +
								(i <
								w.length - 1
									? " "
									: ""),
							font,
						});
					}
				} else if (node.type === "strong") {
					collectWords(
						node.children || [],
						true,
						isItalic,
						isCode,
					);
				} else if (node.type === "emphasis") {
					collectWords(
						node.children || [],
						isBold,
						true,
						isCode,
					);
				} else if (node.type === "inlineCode") {
					collectWords(
						[
							{
								type: "text",
								value: node.value,
							},
						],
						isBold,
						isItalic,
						true,
					);
				}
			}
		};

		collectWords(nodes, forceBold, false, false);

		// Draw words
		for (const word of words) {
			const textWidth = word.font.widthOfTextAtSize(
				word.text,
				this.fontSize,
			);
			if (cursorX + textWidth > this.width - this.margin) {
				this.y -= this.lineHeight;
				cursorX = this.margin + this.currentIndent;
				this.checkPageBreak();
			}

			this.page.drawText(word.text, {
				x: cursorX,
				y: this.y,
				size: this.fontSize,
				font: word.font,
				color: this.currentColor,
			});
			cursorX += textWidth;
		}
		this.y -= this.lineHeight; // End of block (e.g. paragraph)
	}

	private drawText(
		text: string,
		options: {
			isCode?: boolean;
			continuation?: boolean;
			indent?: number;
		} = {},
	) {
		const { isCode = false } = options;
		const currentFont = isCode ? this.codeFont : this.font;
		const lines = text.split("\n");

		for (const line of lines) {
			const words = line.split(" ");
			let cursorX = this.margin + (options.indent || 0); // basic indentation handling

			for (const word of words) {
				const currentWord = word + " ";
				const textWidth = currentFont.widthOfTextAtSize(
					currentWord,
					this.fontSize,
				);

				if (
					cursorX + textWidth >
					this.width - this.margin
				) {
					this.y -= this.lineHeight;
					cursorX = this.margin;
					this.checkPageBreak();
				}

				this.page.drawText(currentWord, {
					x: cursorX,
					y: this.y,
					size: this.fontSize,
					font: currentFont,
					color: this.currentColor,
				});
				cursorX += textWidth;
			}
			this.y -= this.lineHeight;
			this.checkPageBreak();
		}
	}

	private drawImage(image: PDFImage) {
		const maxWidth = this.width - 2 * this.margin;
		let imgWidth = image.width;
		let imgHeight = image.height;

		if (imgWidth > maxWidth) {
			const scale = maxWidth / imgWidth;
			imgWidth = maxWidth;
			imgHeight = imgHeight * scale;
		}

		this.checkPageBreak(imgHeight);

		this.page.drawImage(image, {
			x: this.margin,
			y: this.y - imgHeight,
			width: imgWidth,
			height: imgHeight,
		});

		this.y -= imgHeight + 10;
	}
}
