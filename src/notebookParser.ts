import { TextDecoder } from "util";

export interface NotebookCell {
	cell_type: "markdown" | "code";
	source: string[];
	outputs?: NotebookOutput[];
}

export interface NotebookOutput {
	output_type: string;
	text?: string[];
	data?: { [key: string]: any };
}

export interface NotebookData {
	cells: NotebookCell[];
	metadata: any;
}

export class NotebookParser {
	public parse(content: string): NotebookData {
		try {
			const json = JSON.parse(content);
			const cells = json.cells.map((cell: any) => {
				return {
					cell_type: cell.cell_type,
					source: cell.source,
					outputs: cell.outputs,
				} as NotebookCell;
			});

			return {
				cells,
				metadata: json.metadata,
			};
		} catch (error) {
			throw new Error("Failed to parse notebook: " + error);
		}
	}
}
