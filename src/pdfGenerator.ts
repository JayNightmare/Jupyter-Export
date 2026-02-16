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
	pdf: {
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
			pdf: {
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
					fontFamily: "Courier",
					fontSize: 10,
					backgroundColor: "F0F0F0",
					color: "000000",
				},
			},
		},
	) {
		this.config = config;
		this.fontSize = config.pdf.body.fontSize;
		this.lineHeight = Math.round(this.fontSize * 1.2);
	}

	public async generate(data: NotebookData): Promise<Uint8Array> {
		this.pdfDoc = await PDFDocument.create();

		// Load standard fonts
		// Helper to load font based on name
		const loadFont = async (
			name: string,
			type:
				| "Regular"
				| "Bold"
				| "Italic"
				| "BoldItalic" = "Regular",
		) => {
			let standardFont = StandardFonts.Helvetica;
			if (name === "Times-Roman") {
				if (type === "Regular") {
					standardFont = StandardFonts.TimesRoman;
				}
				if (type === "Bold") {
					standardFont =
						StandardFonts.TimesRomanBold;
				}
				if (type === "Italic") {
					standardFont =
						StandardFonts.TimesRomanItalic;
				}
				if (type === "BoldItalic") {
					standardFont =
						StandardFonts.TimesRomanBoldItalic;
				}
			} else if (name === "Courier") {
				if (type === "Regular") {
					standardFont = StandardFonts.Courier;
				}
				if (type === "Bold") {
					standardFont =
						StandardFonts.CourierBold;
				}
				if (type === "Italic") {
					standardFont =
						StandardFonts.CourierOblique;
				}
				if (type === "BoldItalic") {
					standardFont =
						StandardFonts.CourierBoldOblique;
				}
			} else {
				// Helvetica default
				if (type === "Regular") {
					standardFont = StandardFonts.Helvetica;
				}
				if (type === "Bold") {
					standardFont =
						StandardFonts.HelveticaBold;
				}
				if (type === "Italic") {
					standardFont =
						StandardFonts.HelveticaOblique;
				}
				if (type === "BoldItalic") {
					standardFont =
						StandardFonts.HelveticaBoldOblique;
				}
			}
			return await this.pdfDoc.embedFont(standardFont);
		};

		// Load base fonts based on Body config
		const bodyFontName = this.config.pdf.body.fontFamily;
		this.font = await loadFont(bodyFontName, "Regular");
		this.boldFont = await loadFont(bodyFontName, "Bold");
		this.italicFont = await loadFont(bodyFontName, "Italic");
		this.boldItalicFont = await loadFont(
			bodyFontName,
			"BoldItalic",
		);

		// Code font
		this.codeFont = await loadFont(
			this.config.pdf.code.fontFamily,
			"Regular",
		);

		this.addPage();

		for (const cell of data.cells) {
			if (cell.cell_type === "markdown") {
				await this.processMarkdown(
					cell.source.join(""),
				);
			} else if (cell.cell_type === "code") {
				this.drawCodeBlock(cell.source.join(""));
				this.y -= 10;

				if (cell.outputs) {
					for (const output of cell.outputs) {
						if (output.text) {
							// Output text usually doesn't need highlighting but needs structure
							this.drawCodeBlock(
								output.text.join(
									"",
								),
								true, // isOutput
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

	// Helper to hex to rgb
	private hexToRgb(hex: string): Color {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
			hex,
		);
		if (result) {
			return rgb(
				parseInt(result[1], 16) / 255,
				parseInt(result[2], 16) / 255,
				parseInt(result[3], 16) / 255,
			);
		}
		return rgb(0, 0, 0);
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
				// We need to flatten children to handle mixed styles in ONE flow if possible
				// OR just rely on drawRuns which splits by words.
				// For paragraph mode, we want standard text wrapping.

				// Collect all runs
				this.drawRuns(node.children);
				this.y -= this.lineHeight / 2;
			}
		} else if (node.type === "heading") {
			const depth = node.depth || 1;
			const oldSize = this.fontSize;
			const oldColor = this.currentColor;

			// Config based styling
			let spacingBefore = 10;
			let spacingAfter = 10;
			let styleObj = this.config.pdf.heading1;

			switch (depth) {
				case 1:
					styleObj = this.config.pdf.heading1;
					spacingBefore = 20;
					spacingAfter = 20;
					this.lineHeight = Math.round(
						this.fontSize * 1.2,
					);
					break;
				case 2:
					styleObj = this.config.pdf.heading2;
					spacingBefore = 16;
					spacingAfter = 16;
					this.lineHeight = Math.round(
						this.fontSize * 1.2,
					);
					break;
				case 3:
					styleObj = this.config.pdf.heading3;
					spacingBefore = 14;
					spacingAfter = 14;
					this.lineHeight = Math.round(
						this.fontSize * 1.2,
					);
					break;
				default:
					styleObj = this.config.pdf.body;
					spacingBefore = 12;
					spacingAfter = 12;
					this.lineHeight = Math.round(
						this.fontSize * 1,
					);
					break;
			}

			this.fontSize = styleObj.fontSize;
			this.currentColor = this.hexToRgb(styleObj.color);

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
		} else if (node.type === "code") {
			// Markdown code block
			this.drawCodeBlock(node.value || "");
		}
	}

	private drawCodeBlock(code: string, isOutput: boolean = false) {
		const fontSize = this.config.pdf.code.fontSize;
		const fontFamily = this.codeFont;
		const lineHeight = Math.round(fontSize * 1.2);

		// Background color? Drawing a rectangle for the whole block is hard without pre-calculating height.
		// For now, let's just draw text.

		const lines = code.split("\n");

		// Simple syntax highlighting regex
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
		const keywordRegex = new RegExp(
			`\\b(${keywords.join("|")})\\b`,
			"g",
		);

		const defaultColor = isOutput
			? rgb(0.2, 0.2, 0.2)
			: this.hexToRgb(this.config.pdf.code.color || "000000"); // Only exists if we update interface, assuming black or dark grey
		// wait, code config only has backgroundColor in interface currently?
		// extension.ts shows: code: { fontFamily, fontSize, backgroundColor }
		// so font color is not user configurable yet? defaults to black/dark.

		const keywordColor = rgb(0, 0, 1); // Blue

		for (const line of lines) {
			let cursorX = this.margin + (isOutput ? 20 : 0); // Indent outputs slightly

			this.checkPageBreak();

			// Indentation preservation
			const leadingSpacesMatch = line.match(/^ */);
			const leadingSpacesCount = leadingSpacesMatch
				? leadingSpacesMatch[0].length
				: 0;

			// Calculate space width
			const spaceWidth = fontFamily.widthOfTextAtSize(
				" ",
				fontSize,
			);
			cursorX += leadingSpacesCount * spaceWidth;

			const trimmedContent =
				line.substring(leadingSpacesCount);

			if (trimmedContent.length === 0) {
				this.y -= lineHeight;
				continue;
			}

			if (isOutput) {
				// No highlighting for output
				this.page.drawText(trimmedContent, {
					x: cursorX,
					y: this.y,
					size: fontSize,
					font: fontFamily,
					color: defaultColor,
				});
			} else {
				// Syntax Highlighting
				let lastIndex = 0;
				let match;
				keywordRegex.lastIndex = 0;

				while (
					(match =
						keywordRegex.exec(
							trimmedContent,
						)) !== null
				) {
					// Before match
					const before = trimmedContent.substring(
						lastIndex,
						match.index,
					);
					if (before.length > 0) {
						this.page.drawText(before, {
							x: cursorX,
							y: this.y,
							size: fontSize,
							font: fontFamily,
							color: defaultColor,
						});
						cursorX +=
							fontFamily.widthOfTextAtSize(
								before,
								fontSize,
							);
					}

					// Match
					this.page.drawText(match[0], {
						x: cursorX,
						y: this.y,
						size: fontSize,
						font: fontFamily,
						color: keywordColor,
					});
					cursorX += fontFamily.widthOfTextAtSize(
						match[0],
						fontSize,
					);

					lastIndex = keywordRegex.lastIndex;
				}

				// Remaining
				const remaining =
					trimmedContent.substring(lastIndex);
				if (remaining.length > 0) {
					this.page.drawText(remaining, {
						x: cursorX,
						y: this.y,
						size: fontSize,
						font: fontFamily,
						color: defaultColor,
					});
				}
			}

			this.y -= lineHeight;
		}

		// Add some spacing after block
		this.y -= 5;
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

		if (isCode) {
			this.fontSize = this.config.pdf.code.fontSize;
			// Draw background if needed (complicated in simple text flow)
			// For now just change color?
			// this.currentColor = this.hexToRgb("C7254E"); // Or config
		}

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
