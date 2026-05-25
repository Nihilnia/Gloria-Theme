const path = require('path');
const fs = require('fs');
const vscode = require('vscode');

const messages = {
	ACTIVATED: "Gloria Glow enabled. VS code must reload for this change to take effect. Code may display a warning that it is corrupted, this is normal. You can dismiss this message by choosing 'Don't show this again' on the notification.",
	DEACTIVATED: `Gloria Glow disabled. VS code must reload for this change to take effect`,
	REACTIVATED: "Gloria Glow is already enabled. Reload to refresh JS settings.",
	NOT_RUNNING: `Gloria Glow isn't running.`,
	ERROR_ACCESS_DENIED: "Gloria was unable to modify the core VS code files needed to launch the extension. You may need to run VS code with admin privileges in order to enable the glow effect.",
	ERROR_WORKBENCH_NOT_FOUND: "Gloria could not find the workbench HTML file. This is likely due to a change in VS Code's internal structure.",
	ERROR_GENERIC: "Something went wrong when starting Gloria"
};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	this.extensionName = 'Nihil.gloria-theme';
	this.cntx = context;

	const config = vscode.workspace.getConfiguration("gloria");

	let disableGlow = config && config.disableGlow ? !!config.disableGlow : false;

	let brightness = parseFloat(config.brightness) > 1 ? 1 : parseFloat(config.brightness);
	brightness = brightness < 0 ? 0 : brightness;
	brightness = isNaN(brightness) ? 0.45 : brightness;

	const parsedBrightness = Math.floor(brightness * 255).toString(16).toUpperCase();
	let neonBrightness = parsedBrightness;

	let disposable = vscode.commands.registerCommand('gloria.enableNeon', function () {
		const appDir = path.dirname(vscode.env.appRoot);
		const base = path.join(appDir, 'app', 'out', 'vs', 'code');

		const workbenchPaths = resolveWorkbenchPaths(base);
		if (!workbenchPaths) {
			vscode.window.showErrorMessage(messages.ERROR_WORKBENCH_NOT_FOUND);
			return;
		}
		const [electronBase, workBenchFilename] = workbenchPaths;

		const htmlFile = path.join(base, electronBase, "workbench", workBenchFilename);
		const templateFile = path.join(base, electronBase, "workbench", "gloria.js");

		try {
			// generate production theme JS
			const chromeStyles = fs.readFileSync(__dirname + '/css/editor_chrome.css', 'utf-8');
			const jsTemplate = fs.readFileSync(__dirname + '/js/theme_template.js', 'utf-8');
			const themeWithGlow = jsTemplate.replace(/\[DISABLE_GLOW\]/g, disableGlow);
			const themeWithChrome = themeWithGlow.replace(/\[CHROME_STYLES\]/g, chromeStyles);
			const finalTheme = themeWithChrome.replace(/\[NEON_BRIGHTNESS\]/g, neonBrightness);
			fs.writeFileSync(templateFile, finalTheme, "utf-8");

			// modify workbench html
			const html = fs.readFileSync(htmlFile, "utf-8");

			// check if the tag is already there
			const isEnabled = html.includes("gloria.js");

			if (!isEnabled) {
				// delete script tag if there
				let output = html
					.replace(/^.*(<!-- GLORIA --><script src="gloria.js"><\/script><!-- GLORIA GLOW -->).*\n?/mg, '');

				// add script tag
				output = html
					.replace(/\<\/html\>/g, `	<!-- GLORIA --><script src="gloria.js"></script><!-- GLORIA GLOW -->\n`);
				output += '</html>';

				fs.writeFileSync(htmlFile, output, "utf-8");

				vscode.window
					.showInformationMessage(messages.ACTIVATED, { title: "Restart editor to complete" })
					.then(function(msg) {
						vscode.commands.executeCommand("workbench.action.reloadWindow");
					});
			} else {
				vscode.window
					.showInformationMessage(messages.REACTIVATED, { title: "Restart editor to refresh settings" })
					.then(function(msg) {
						vscode.commands.executeCommand("workbench.action.reloadWindow");
					});
			}
		} catch (e) {
			if (/ENOENT|EACCES|EPERM/.test(e.code)) {
				vscode.window.showInformationMessage(messages.ERROR_ACCESS_DENIED);
				return;
			} else {
				vscode.window.showErrorMessage(messages.ERROR_GENERIC);
				return;
			}
		}
	});

	let disable = vscode.commands.registerCommand('gloria.disableNeon', uninstall);

	context.subscriptions.push(disposable);
	context.subscriptions.push(disable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
	// ...
}

function uninstall() {
	const appDir = path.dirname(vscode.env.appRoot);
	const base = path.join(appDir, 'app', 'out', 'vs', 'code');

	const workbenchPaths = resolveWorkbenchPaths(base);
	if (!workbenchPaths) {
		vscode.window.showErrorMessage(messages.ERROR_WORKBENCH_NOT_FOUND);
		return;
	}
	const [electronBase, workBenchFilename] = workbenchPaths;

	const htmlFile = path.join(base, electronBase, "workbench", workBenchFilename);

	try {
		// modify workbench html
		const html = fs.readFileSync(htmlFile, "utf-8");

		// check if the tag is already there
		const isEnabled = html.includes("gloria.js");

		if (isEnabled) {
			// delete script tag if there
			let output = html.replace(/^.*(<!-- GLORIA --><script src="gloria.js"><\/script><!-- GLORIA GLOW -->).*\n?/mg, '');
			fs.writeFileSync(htmlFile, output, "utf-8");

			vscode.window
				.showInformationMessage(messages.DEACTIVATED, { title: "Restart editor to complete" })
				.then(function(msg) {
					vscode.commands.executeCommand("workbench.action.reloadWindow");
				});
		} else {
			vscode.window.showInformationMessage(messages.NOT_RUNNING);
		}
	} catch (e) {
		if (/ENOENT|EACCES|EPERM/.test(e.code)) {
			vscode.window.showInformationMessage(messages.ERROR_ACCESS_DENIED);
			return;
		} else {
			vscode.window.showErrorMessage(messages.ERROR_GENERIC);
			return;
		}
	}
}

function resolveWorkbenchPaths(base) {
	const electronBaseCandidates = [
		"electron-browser",
		"electron-sandbox",
	]

	const htmlCandidates = [
		"workbench.esm.html",
		"workbench.html",
	];

	for (const electronBase of electronBaseCandidates) {
		for (const htmlFile of htmlCandidates) {
			if (fs.existsSync(path.join(base, electronBase, "workbench", htmlFile))) {
				return [electronBase, htmlFile];
			}
		}
	}

	return null;
}

module.exports = {
	activate,
	deactivate
}