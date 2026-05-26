const path = require('path');
const fs = require('fs');
const vscode = require('vscode');

// Centralise errors & info messages to keep activation code clean
const messages = {
	ACTIVATED: "Glow enabled. VS code must reload for this change to take effect. Code may display a warning that it is corrupted, this is normal. You can dismiss this message by choosing 'Don't show this again' on the notification.",
	DEACTIVATED: `Glow disabled. VS code must reload for this change to take effect`,
	REACTIVATED: "Glow is already enabled. Reload to refresh JS settings.",
	NOT_RUNNING: `Glow isn't running.`,
	ERROR_ACCESS_DENIED: "Glow was unable to modify the core VS code files needed to launch the extension. You may need to run VS code with admin privileges in order to enable Glow.",
	ERROR_WORKBENCH_NOT_FOUND: "Glow could not find the workbench HTML file. This is likely due to a change in VS Code's internal structure. Please open an issue on the Gloria Theme GitHub repository to report this.",
	ERROR_GENERIC: "Something went wrong when starting Glow"
};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	this.extensionName = 'Nihil.gloria-theme';
	this.cntx = context;

	const config = vscode.workspace.getConfiguration("gloria");

	let disableGlowSetting = config && config.disableGlow ? !!config.disableGlow : false;

	let brightness = parseFloat(config.brightness) > 1 ? 1 : parseFloat(config.brightness);
	brightness = brightness < 0 ? 0 : brightness;
	brightness = isNaN(brightness) ? 0.45 : brightness;

	const parsedBrightness = Math.floor(brightness * 255).toString(16).toUpperCase().padStart(2, '0');
	let neonBrightness = parsedBrightness;

	let disposable = vscode.commands.registerCommand('gloria.enableGlow', function () {
		const appDir = path.dirname(vscode.env.appRoot);
		const base = path.join(appDir, 'app', 'out', 'vs', 'code');

		const workbenchPaths = resolveWorkbenchPaths(base);
		if (!workbenchPaths) {
			vscode.window.showErrorMessage(messages.ERROR_WORKBENCH_NOT_FOUND);
			return;
		}
		const [electronBase, workBenchFilename] = workbenchPaths;

		const htmlFile = path.join(base, electronBase, "workbench", workBenchFilename);
		const templateFile = path.join(base, electronBase, "workbench", "gloria_glow.js");

		try {
			// generate production theme JS
			const chromeStyles = fs.readFileSync(__dirname + '/css/editor_chrome.css', 'utf-8');
			const jsTemplate = fs.readFileSync(__dirname + '/js/theme_template.js', 'utf-8');
			const themeWithGlow = jsTemplate.replace(/\[DISABLE_GLOW\]/g, disableGlowSetting);
			const themeWithChrome = themeWithGlow.replace(/\[CHROME_STYLES\]/g, chromeStyles);
			const finalTheme = themeWithChrome.replace(/\[NEON_BRIGHTNESS\]/g, neonBrightness);
			fs.writeFileSync(templateFile, finalTheme, "utf-8");

			// modify workbench html
			const html = fs.readFileSync(htmlFile, "utf-8");

			// check if the tag is already there
			const isEnabled = html.includes("gloria_glow.js");

			if (!isEnabled) {
				// delete gloria script tag if there (compatibility for old versions)
				let output = html
					.replace(/^.*(<!-- GLORIA --><script src="neondreams.js"><\/script><!-- NEON DREAMS -->).*\n?/mg, '')
					.replace(/^.*(<!-- GLORIA --><script src="gloria_glow.js"><\/script><!-- GLOW -->).*\n?/mg, '');

				// add script tag
				output = output
					.replace(/\<\/html\>/g, `	<!-- GLORIA --><script src="gloria_glow.js"></script><!-- GLOW -->\n`);
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

	let disable = vscode.commands.registerCommand('gloria.disableGlow', uninstall);

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
	const templateFile = path.join(base, electronBase, "workbench", "gloria_glow.js");
	const oldTemplateFile = path.join(base, electronBase, "workbench", "neondreams.js");

	try {
		// modify workbench html
		const html = fs.readFileSync(htmlFile, "utf-8");

		// check if the tag is already there
		const isEnabled = html.includes("gloria_glow.js") || html.includes("neondreams.js");

		if (isEnabled) {
			// delete gloria script tag if there
			let output = html
				.replace(/^.*(<!-- GLORIA --><script src="neondreams.js"><\/script><!-- NEON DREAMS -->).*\n?/mg, '')
				.replace(/^.*(<!-- GLORIA --><script src="gloria_glow.js"><\/script><!-- GLOW -->).*\n?/mg, '');
			
			fs.writeFileSync(htmlFile, output, "utf-8");

			// delete the js files if they exist
			if (fs.existsSync(templateFile)) {
				fs.unlinkSync(templateFile);
			}
			if (fs.existsSync(oldTemplateFile)) {
				fs.unlinkSync(oldTemplateFile);
			}

			vscode.window
				.showInformationMessage(messages.DEACTIVATED, { title: "Restart editor to complete" })
				.then(function(msg) {
					vscode.commands.executeCommand("workbench.action.reloadWindow");
				});
		} else {
			// Even if not "enabled", try to clean up anyway in case of corruption
			let output = html
				.replace(/<!-- GLORIA -->.*?<!-- NEON DREAMS -->\n?/g, '')
				.replace(/<!-- GLORIA -->.*?<!-- GLOW -->\n?/g, '')
				.replace(/<script src="gloria_glow\.js"><\/script>/g, '')
				.replace(/<script src="neondreams\.js"><\/script>/g, '');
			
			if (output !== html) {
				fs.writeFileSync(htmlFile, output, "utf-8");
				vscode.window.showInformationMessage("Cleaned up orphaned Glow tags. Restart to complete.");
			} else {
				vscode.window.showInformationMessage(messages.NOT_RUNNING);
			}
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

// Find the workbench HTML file and electron base directory.
// Returns an array with the electron base directory and the workbench HTML filename.
// If not found, returns null.
function resolveWorkbenchPaths(base) {
	const electronBaseCandidates = [
		// v1.70-, v1.102+
		"electron-browser",
		// v1.70 ~ v1.102
		"electron-sandbox",
	]

	const htmlCandidates = [
		// v1.94.0
		"workbench.esm.html",
		// other
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
te,
	deactivate
}
