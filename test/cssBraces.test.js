const assert = require('assert');
const { findCssCurlyBraceRanges, findEmbeddedCssCurlyBraceRanges } = require('../src/cssBraces');

function highlightedCharacters(source) {
	return findCssCurlyBraceRanges(source).map(range => source.slice(range.start, range.start + range.length));
}

assert.deepStrictEqual(
	highlightedCharacters('.atmosphere::before { content: ""; }'),
	['{', '}']
);

assert.deepStrictEqual(
	highlightedCharacters('@media (width > 40rem) { .card { display: block; } }'),
	['{', '{', '}', '}']
);

assert.deepStrictEqual(
	highlightedCharacters('.card { content: "{not-a-block}"; /* } neither is this { */ }'),
	['{', '}']
);

assert.deepStrictEqual(
	highlightedCharacters('.card { content: \'escaped \\\' } text\'; }'),
	['{', '}']
);

const embeddedSource = [
	'<!-- <style>.ignored { color: red; }</style> -->',
	'<style media="screen and (min-width: 1px)">',
	'	.card { color: green; }',
	'</style>',
	'<script>const ignored = { value: true };</script>'
].join('\n');

assert.deepStrictEqual(
	findEmbeddedCssCurlyBraceRanges(embeddedSource).map(
		range => embeddedSource.slice(range.start, range.start + range.length)
	),
	['{', '}']
);

console.log('CSS curly-brace scanner tests passed.');
