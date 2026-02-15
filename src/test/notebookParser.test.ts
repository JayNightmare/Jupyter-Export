import * as assert from "assert";
import { NotebookParser } from "../notebookParser";

suite("NotebookParser Test Suite", () => {
	test("Parses basic notebook correctly", () => {
		const rawContent = JSON.stringify({
			cells: [
				{
					cell_type: "markdown",
					source: ["# Hello World"],
				},
				{
					cell_type: "code",
					source: ['print("Hello")'],
					outputs: [
						{
							output_type: "stream",
							name: "stdout",
							text: ["Hello\n"],
						},
					],
				},
			],
		});

		const parser = new NotebookParser();
		const data = parser.parse(rawContent);

		assert.strictEqual(data.cells.length, 2);
		assert.strictEqual(data.cells[0].cell_type, "markdown");
		assert.strictEqual(data.cells[0].source[0], "# Hello World");
		assert.strictEqual(data.cells[1].cell_type, "code");
		assert.strictEqual(data.cells[1].outputs?.length, 1);
	});

	test("Handles empty notebook", () => {
		const rawContent = JSON.stringify({ cells: [] });
		const parser = new NotebookParser();
		const data = parser.parse(rawContent);
		assert.strictEqual(data.cells.length, 0);
	});
});
