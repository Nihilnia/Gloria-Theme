const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const { findGrandparentTagRanges } = require('./htmlGrandparents');
const { findCssCurlyBraceRanges, findEmbeddedCssCurlyBraceRanges } = require('./cssBraces');

const messages = {
	ACTIVATED: "Gloria enabled. VS code must reload for this change to take effect. Code may display a warning that it is corrupted, this is normal.",
	ERROR_WORKBENCH_NOT_FOUND: "Could not find workbench HTML file.",
	ERROR_GENERIC: "Something went wrong"
};

function activate(context) {
	registerDynamicGlowDecorations(context, 'html', findGrandparentTagRanges);
	registerDynamicGlowDecorations(context, 'html', findEmbeddedCssCurlyBraceRanges);
	registerDynamicGlowDecorations(context, 'css', findCssCurlyBraceRanges);

	const config = vscode.workspace.getConfiguration("gloria");
	let disableGlow = config && config.disableGlow ? !!config.disableGlow : false;
	let brightness = parseFloat(config.brightness) > 1 ? 1 : parseFloat(config.brightness);
	brightness = brightness < 0 ? 0 : brightness;
	brightness = isNaN(brightness) ? 0.45 : brightness;

	const parsedBrightness = Math.floor(brightness * 255).toString(16).padStart(2, '0').toUpperCase();
	let neonBrightness = parsedBrightness;

    const appDir = path.dirname(vscode.env.appRoot);
    const base = path.join(appDir, 'app', 'out', 'vs', 'code');
    const workbenchPaths = resolveWorkbenchPaths(base);
    
    if (!workbenchPaths) {
        return; // silently fail if not found, don't spam errors on startup
    }
    const [electronBase, workBenchFilename] = workbenchPaths;

    const htmlFile = path.join(base, electronBase, "workbench", workBenchFilename);
    const templateFile = path.join(base, electronBase, "workbench", "gloria-neondreams.js");

    try {
        const chromeStyles = fs.readFileSync(path.join(__dirname, 'css', 'editor_chrome.css'), 'utf-8');
        const jsTemplate = fs.readFileSync(path.join(__dirname, 'js', 'theme_template.js'), 'utf-8');
        const themeWithGlow = jsTemplate.replace(/\[DISABLE_GLOW\]/g, disableGlow);
        const themeWithChrome = themeWithGlow.replace(/\[CHROME_STYLES\]/g, chromeStyles);
        const finalTheme = themeWithChrome.replace(/\[NEON_BRIGHTNESS\]/g, neonBrightness);
        
        // Always write the latest JS template with current settings
        fs.writeFileSync(templateFile, finalTheme, "utf-8");

        const html = fs.readFileSync(htmlFile, "utf-8");
        const isEnabled = html.includes("gloria-neondreams.js");

        if (!isEnabled) {
            let output = html.replace(/^.*(<!-- GLORIA --><script src="gloria-neondreams.js"><\/script><!-- NEON DREAMS -->).*\n?/mg, '');
            output = html.replace(/\<\/html\>/g, `	<!-- GLORIA --><script src="gloria-neondreams.js"></script><!-- NEON DREAMS -->\n</html>`);

            fs.writeFileSync(htmlFile, output, "utf-8");

            vscode.window
                .showInformationMessage(messages.ACTIVATED, { title: "Restart editor to complete" })
                .then(function(msg) {
                    if (msg) {
                        vscode.commands.executeCommand("workbench.action.reloadWindow");
                    }
                });
        }
    } catch (e) {
        console.error(e);
    }
}
exports.activate = activate;

function registerDynamicGlowDecorations(context, languageId, findRanges) {
	const refreshTimers = new Map();
	let decorationType = createWhiteGlowDecorationType();

	const usingGloria = () =>
		vscode.workspace.getConfiguration('workbench').get('colorTheme') === 'Gloria';

	const updateEditor = editor => {
		if (!editor || editor.document.languageId !== languageId || !usingGloria()) {
			if (editor) editor.setDecorations(decorationType, []);
			return;
		}

		const ranges = findRanges(editor.document.getText()).map(range =>
			new vscode.Range(
				editor.document.positionAt(range.start),
				editor.document.positionAt(range.start + range.length)
			)
		);
		editor.setDecorations(decorationType, ranges);
	};

	const updateVisibleEditors = () => {
		for (const editor of vscode.window.visibleTextEditors) updateEditor(editor);
	};

	const scheduleDocumentUpdate = document => {
		if (document.languageId !== languageId) return;

		const key = document.uri.toString();
		const previousTimer = refreshTimers.get(key);
		if (previousTimer) clearTimeout(previousTimer);

		refreshTimers.set(key, setTimeout(() => {
			refreshTimers.delete(key);
			for (const editor of vscode.window.visibleTextEditors) {
				if (editor.document === document) updateEditor(editor);
			}
		}, 75));
	};

	context.subscriptions.push(
		vscode.window.onDidChangeVisibleTextEditors(updateVisibleEditors),
		vscode.window.onDidChangeActiveTextEditor(updateEditor),
		vscode.workspace.onDidChangeTextDocument(event => scheduleDocumentUpdate(event.document)),
		vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('gloria.brightness') ||
				event.affectsConfiguration('gloria.disableGlow')) {
				decorationType.dispose();
				decorationType = createWhiteGlowDecorationType();
			}

			if (event.affectsConfiguration('workbench.colorTheme') ||
				event.affectsConfiguration('gloria')) {
				updateVisibleEditors();
			}
		}),
		{
			dispose() {
				for (const timer of refreshTimers.values()) clearTimeout(timer);
				refreshTimers.clear();
				decorationType.dispose();
			}
		}
	);

	updateVisibleEditors();
}

function createWhiteGlowDecorationType() {
	const config = vscode.workspace.getConfiguration('gloria');
	const disableGlow = !!config.get('disableGlow', false);
	const configuredBrightness = Number.parseFloat(config.get('brightness', 0.45));
	const brightness = Number.isFinite(configuredBrightness)
		? Math.min(1, Math.max(0, configuredBrightness))
		: 0.45;
	const alpha = Math.floor(brightness * 255).toString(16).padStart(2, '0').toUpperCase();
	const textShadow = disableGlow
		? 'none'
		: `0 0 2px #393a33, 0 0 8px #ffffff${alpha}, 0 0 25px #ffffff${alpha}`;

	return vscode.window.createTextEditorDecorationType({
		color: '#fdfdfd',
		textDecoration: `none; text-shadow: ${textShadow}; backface-visibility: hidden`,
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
	});
}

function deactivate() {}

function resolveWorkbenchPaths(base) {
	const electronBaseCandidates = ["electron-browser", "electron-sandbox"];
	const htmlCandidates = ["workbench.esm.html", "workbench.html"];
	for (const electronBase of electronBaseCandidates) {
		for (const htmlFile of htmlCandidates) {
			if (fs.existsSync(path.join(base, electronBase, "workbench", htmlFile))) {
				return [electronBase, htmlFile];
			}
		}
	}
	return null;
}

module.exports = { activate, deactivate }
