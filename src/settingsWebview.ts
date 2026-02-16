import * as vscode from "vscode";

export class SettingsWebview {
	public static currentPanel: SettingsWebview | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
	) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(
			() => this.dispose(),
			null,
			this._disposables,
		);

		// Update the content based on view state changes
		this._panel.onDidChangeViewState(
			(e) => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables,
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case "saveSettings":
						await this._saveSettings(
							message.settings,
						);
						vscode.window.showInformationMessage(
							"Export settings saved!",
						);
						return;
				}
			},
			null,
			this._disposables,
		);
	}

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (SettingsWebview.currentPanel) {
			SettingsWebview.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			"jupyterExportStyling",
			"Export Styling",
			column || vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [
					vscode.Uri.joinPath(
						extensionUri,
						"media",
					),
				],
			},
		);

		SettingsWebview.currentPanel = new SettingsWebview(
			panel,
			extensionUri,
		);
	}

	public dispose() {
		SettingsWebview.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const config = vscode.workspace.getConfiguration();

		// Helper to get value safe
		const getVal = (key: string) => config.get(key);

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Export Styling</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
        h1 { font-size: 1.5em; margin-bottom: 20px; }
        h2 { font-size: 1.2em; margin-top: 20px; border-bottom: 1px solid var(--vscode-settings-dropdownBorder); padding-bottom: 5px; }
        .tabs { display: flex; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 20px; }
        .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; }
        .tab.active { border-bottom-color: var(--vscode-panelTitle-activeBorder); font-weight: bold; }
        .content { display: none; }
        .content.active { display: block; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: 600; }
        input[type="text"], input[type="number"], select { 
            width: 100%; 
            padding: 5px; 
            background: var(--vscode-input-background); 
            color: var(--vscode-input-foreground); 
            border: 1px solid var(--vscode-input-border); 
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 1em;
            margin-top: 20px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .color-preview {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 1px solid #ccc;
            vertical-align: middle;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <h1>Export Styling</h1>

    <div class="tabs">
        <div class="tab active" onclick="openTab('word')">Word (.docx)</div>
        <div class="tab" onclick="openTab('pdf')">PDF (.pdf)</div>
    </div>

    <div id="word" class="content active">
        <h2>Headings</h2>
        ${this._renderInputs("word", "heading1", "Heading 1", config)}
        ${this._renderInputs("word", "heading2", "Heading 2", config)}
        ${this._renderInputs("word", "heading3", "Heading 3", config)}
        
        <h2>Body & Code</h2>
        ${this._renderInputs("word", "body", "Body Text", config)}
        ${this._renderInputs("word", "code", "Code Blocks", config)}
    </div>

    <div id="pdf" class="content">
        <h2>Headings</h2>
        ${this._renderInputs("pdf", "heading1", "Heading 1", config)}
        ${this._renderInputs("pdf", "heading2", "Heading 2", config)}
        ${this._renderInputs("pdf", "heading3", "Heading 3", config)}

        <h2>Body & Code</h2>
        ${this._renderInputs("pdf", "body", "Body Text", config)}
        ${this._renderInputs("pdf", "code", "Code Blocks", config)}
    </div>

    <button onclick="saveSettings()">Save Settings</button>

    <script>
        const vscode = acquireVsCodeApi();

        function openTab(tabName) {
            document.querySelectorAll('.content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            event.target.classList.add('active');
        }

        function saveSettings() {
            const settings = {};
            document.querySelectorAll('input, select').forEach(input => {
                if(input.id) {
                    const val = input.type === 'number' ? parseFloat(input.value) : input.value;
                    settings[input.id] = val;
                }
            });
            vscode.postMessage({
                command: 'saveSettings',
                settings: settings
            });
        }
    </script>
</body>
</html>`;
	}

	private _renderInputs(
		format: string,
		element: string,
		label: string,
		config: vscode.WorkspaceConfiguration,
	) {
		const prefix = `jupyterExport.${format}.${element}`;
		const fontFamily = config.get(`${prefix}.fontFamily`);
		const fontSize = config.get(`${prefix}.fontSize`);
		const color = config.get(`${prefix}.color`);
		const bgColor = config.get(`${prefix}.backgroundColor`); // Only for code

		let html = `<div class="form-group"><strong>${label}</strong></div>`;

		html += `<div class="form-group"><label>Font Family</label>
        <input type="text" id="${prefix}.fontFamily" value="${fontFamily}"></div>`;

		html += `<div class="form-group"><label>Font Size</label>
        <input type="number" id="${prefix}.fontSize" value="${fontSize}"></div>`;

		if (color !== undefined) {
			html += `<div class="form-group"><label>Color (Hex)</label>
            <input type="text" id="${prefix}.color" value="${color}"></div>`;
		}

		if (bgColor !== undefined) {
			html += `<div class="form-group"><label>Background Color (Hex)</label>
           <input type="text" id="${prefix}.backgroundColor" value="${bgColor}"></div>`;
		}

		return `<div style="border-left: 3px solid var(--vscode-textBlockQuote-border); padding-left: 10px; margin-bottom: 20px;">${html}</div>`;
	}

	private async _saveSettings(settings: any) {
		const config = vscode.workspace.getConfiguration();
		for (const key in settings) {
			await config.update(
				key,
				settings[key],
				vscode.ConfigurationTarget.Global,
			);
		}
	}
}
