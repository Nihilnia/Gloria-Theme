function findCssCurlyBraceRanges(text, baseOffset = 0) {
	const ranges = [];
	let quote;
	let inComment = false;

	for (let index = 0; index < text.length; index++) {
		const character = text[index];
		const nextCharacter = text[index + 1];

		if (inComment) {
			if (character === '*' && nextCharacter === '/') {
				inComment = false;
				index++;
			}
			continue;
		}

		if (quote) {
			if (character === '\\') {
				index++;
			} else if (character === quote) {
				quote = undefined;
			}
			continue;
		}

		if (character === '/' && nextCharacter === '*') {
			inComment = true;
			index++;
			continue;
		}

		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}

		if (character === '{' || character === '}') {
			ranges.push({ start: baseOffset + index, length: 1 });
		}
	}

	return ranges;
}

function findEmbeddedCssCurlyBraceRanges(html) {
	const ranges = [];
	let cursor = 0;

	while (cursor < html.length) {
		const tagStart = html.indexOf('<', cursor);
		if (tagStart === -1) break;

		if (html.startsWith('<!--', tagStart)) {
			const commentEnd = html.indexOf('-->', tagStart + 4);
			cursor = commentEnd === -1 ? html.length : commentEnd + 3;
			continue;
		}

		const isClosing = html[tagStart + 1] === '/';
		let nameStart = tagStart + (isClosing ? 2 : 1);
		while (/\s/.test(html[nameStart] || '')) nameStart++;

		const nameMatch = /^[A-Za-z][A-Za-z0-9:._-]*/.exec(html.slice(nameStart));
		if (!nameMatch) {
			cursor = tagStart + 1;
			continue;
		}

		const tagName = nameMatch[0].toLowerCase();
		const openTagEnd = findHtmlTagEnd(html, nameStart + nameMatch[0].length);
		if (isClosing) {
			cursor = openTagEnd + 1;
			continue;
		}

		if (tagName !== 'style' && tagName !== 'script') {
			cursor = openTagEnd + 1;
			continue;
		}

		const closingTag = new RegExp(`<\\/\\s*${tagName}\\b`, 'ig');
		closingTag.lastIndex = openTagEnd + 1;
		const closingMatch = closingTag.exec(html);
		const contentEnd = closingMatch ? closingMatch.index : html.length;

		if (tagName === 'style') {
			const contentStart = openTagEnd + 1;
			ranges.push(...findCssCurlyBraceRanges(
				html.slice(contentStart, contentEnd),
				contentStart
			));
		}

		cursor = closingMatch
			? findHtmlTagEnd(html, closingMatch.index + closingMatch[0].length) + 1
			: html.length;
	}

	return ranges;
}

function findHtmlTagEnd(text, from) {
	let quote;
	for (let index = from; index < text.length; index++) {
		const character = text[index];
		if (quote) {
			if (character === quote) quote = undefined;
			continue;
		}

		if (character === '"' || character === "'") {
			quote = character;
		} else if (character === '>') {
			return index;
		}
	}
	return text.length - 1;
}

module.exports = { findCssCurlyBraceRanges, findEmbeddedCssCurlyBraceRanges };
