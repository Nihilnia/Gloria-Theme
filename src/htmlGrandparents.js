const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);

const P_CLOSING_ELEMENTS = new Set([
	"address",
	"article",
	"aside",
	"blockquote",
	"details",
	"dialog",
	"div",
	"dl",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hgroup",
	"hr",
	"main",
	"menu",
	"nav",
	"ol",
	"p",
	"pre",
	"section",
	"table",
	"ul",
]);

function findGrandparentTagRanges(text) {
	const elements = parseHtmlElements(text);
	const grandparents = new Set(
		elements.filter((element) =>
			element.children.some((child) => child.children.length > 0),
		),
	);
	const ranges = [];

	for (const element of grandparents) {
		if (hasQualifyingParentOfSameTag(element, grandparents)) continue;

		ranges.push(element.openName);
		if (element.closeName) ranges.push(element.closeName);
	}

	return ranges.sort((left, right) => left.start - right.start);
}

function hasQualifyingParentOfSameTag(element, grandparents) {
	return (
		!!element.parent &&
		element.parent.tagName === element.tagName &&
		grandparents.has(element.parent)
	);
}

function parseHtmlElements(text) {
	const elements = [];
	const stack = [];
	let cursor = 0;

	while (cursor < text.length) {
		const rawElement = stack[stack.length - 1];
		let tagStart;

		if (rawElement && RAW_TEXT_ELEMENTS.has(rawElement.tagName)) {
			tagStart = findRawClosingTag(text, cursor, rawElement.tagName);
			if (tagStart === -1) break;
		} else {
			tagStart = text.indexOf("<", cursor);
			if (tagStart === -1) break;
		}

		if (text.startsWith("<!--", tagStart)) {
			const commentEnd = text.indexOf("-->", tagStart + 4);
			cursor = commentEnd === -1 ? text.length : commentEnd + 3;
			continue;
		}

		if (text.startsWith("<![CDATA[", tagStart)) {
			const cdataEnd = text.indexOf("]]>", tagStart + 9);
			cursor = cdataEnd === -1 ? text.length : cdataEnd + 3;
			continue;
		}

		if (text[tagStart + 1] === "!" || text[tagStart + 1] === "?") {
			cursor = findTagEnd(text, tagStart + 2) + 1;
			continue;
		}

		const isClosing = text[tagStart + 1] === "/";
		let nameStart = tagStart + (isClosing ? 2 : 1);
		while (/\s/.test(text[nameStart] || "")) nameStart++;

		const nameMatch = /^[A-Za-z][A-Za-z0-9:._-]*/.exec(text.slice(nameStart));
		if (!nameMatch) {
			cursor = tagStart + 1;
			continue;
		}

		const originalTagName = nameMatch[0];
		const tagName = originalTagName.toLowerCase();
		const nameEnd = nameStart + originalTagName.length;
		const tagEnd = findTagEnd(text, nameEnd);

		if (isClosing) {
			closeElement(stack, tagName, {
				start: nameStart,
				length: originalTagName.length,
			});
			cursor = tagEnd + 1;
			continue;
		}

		closeImplicitElements(stack, tagName);

		const parent = stack[stack.length - 1];
		const element = {
			tagName,
			openName: { start: nameStart, length: originalTagName.length },
			closeName: undefined,
			parent,
			children: [],
		};

		if (parent) parent.children.push(element);
		elements.push(element);

		const tagBody = text.slice(nameEnd, tagEnd);
		const isSelfClosing = /\/\s*$/.test(tagBody);
		if (!isSelfClosing && !VOID_ELEMENTS.has(tagName)) stack.push(element);

		cursor = tagEnd + 1;
	}

	return elements;
}

function closeElement(stack, tagName, closeName) {
	for (let index = stack.length - 1; index >= 0; index--) {
		if (stack[index].tagName !== tagName) continue;

		stack[index].closeName = closeName;
		stack.length = index;
		return;
	}
}

function closeImplicitElements(stack, nextTagName) {
	while (stack.length > 0) {
		const currentTagName = stack[stack.length - 1].tagName;
		if (!shouldCloseImplicitly(currentTagName, nextTagName)) return;
		stack.pop();
	}
}

function shouldCloseImplicitly(currentTagName, nextTagName) {
	if (currentTagName === "li" && nextTagName === "li") return true;
	if (
		(currentTagName === "dt" || currentTagName === "dd") &&
		(nextTagName === "dt" || nextTagName === "dd")
	)
		return true;
	if (currentTagName === "p" && P_CLOSING_ELEMENTS.has(nextTagName))
		return true;
	if (
		(currentTagName === "rt" || currentTagName === "rp") &&
		(nextTagName === "rt" || nextTagName === "rp")
	)
		return true;
	if (
		currentTagName === "option" &&
		(nextTagName === "option" || nextTagName === "optgroup")
	)
		return true;
	if (currentTagName === "optgroup" && nextTagName === "optgroup") return true;
	if (
		(currentTagName === "thead" ||
			currentTagName === "tbody" ||
			currentTagName === "tfoot") &&
		(nextTagName === "thead" ||
			nextTagName === "tbody" ||
			nextTagName === "tfoot")
	)
		return true;
	if (
		currentTagName === "tr" &&
		(nextTagName === "tr" || nextTagName === "tbody" || nextTagName === "tfoot")
	)
		return true;
	if (
		(currentTagName === "td" || currentTagName === "th") &&
		(nextTagName === "td" ||
			nextTagName === "th" ||
			nextTagName === "tr" ||
			nextTagName === "tbody" ||
			nextTagName === "tfoot")
	)
		return true;
	return false;
}

function findRawClosingTag(text, from, tagName) {
	const pattern = new RegExp(`<\\/\\s*${escapeRegExp(tagName)}\\b`, "ig");
	pattern.lastIndex = from;
	const match = pattern.exec(text);
	return match ? match.index : -1;
}

function findTagEnd(text, from) {
	let quote;

	for (let index = from; index < text.length; index++) {
		const character = text[index];
		if (quote) {
			if (character === quote) quote = undefined;
			continue;
		}

		if (character === '"' || character === "'") {
			quote = character;
		} else if (character === ">") {
			return index;
		}
	}

	return text.length - 1;
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { findGrandparentTagRanges };
