const assert = require('assert');
const { findGrandparentTagRanges } = require('../src/htmlGrandparents');

function highlightedTags(source) {
	return findGrandparentTagRanges(source).map(range => source.slice(range.start, range.start + range.length));
}

assert.deepStrictEqual(
	highlightedTags('<html><body><main><p>Text</p></main></body></html>'),
	['html', 'body', 'body', 'html']
);

assert.deepStrictEqual(
	highlightedTags('<div><span>One</span><span>Two</span></div>'),
	[]
);

assert.deepStrictEqual(
	highlightedTags('<div><section><span>Text</span></section></div>'),
	['div', 'div']
);

assert.deepStrictEqual(
	highlightedTags('<div><img src="x"><span>Text</span></div>'),
	[]
);

assert.deepStrictEqual(
	highlightedTags('<div><!-- <fake><child></child></fake> --><span>Text</span></div>'),
	[]
);

assert.deepStrictEqual(
	highlightedTags('<div><script>const value = "<fake><child></child></fake>";</script><span>Text</span></div>'),
	[]
);

assert.deepStrictEqual(
	highlightedTags('<ul><li><span>One</span><li><span>Two</span></ul>'),
	['ul', 'ul']
);

assert.deepStrictEqual(
	highlightedTags([
		'<div class="sidebar-footer">',
		'	<div class="user-card">',
		'		<div class="avatar">U</div>',
		'		<div class="user-info">',
		'			<strong>User</strong>',
		'			<span>Local session</span>',
		'		</div>',
		'</div>',
		'</div>'
	].join('\n')),
	['div', 'div']
);

assert.deepStrictEqual(
	highlightedTags('<div><section><span></span></section></div><main><article><p></p></article></main>'),
	['div', 'div', 'main', 'main']
);

assert.deepStrictEqual(
	highlightedTags([
		'<html><body><aside>',
		'<div class="sidebar-footer">',
		'	<div class="user-card">',
		'		<div class="avatar">U</div>',
		'		<div class="user-info"><strong>User</strong><span>Local</span></div>',
		'	</div>',
		'</div>',
		'</aside></body></html>'
	].join('\n')),
	['html', 'body', 'aside', 'div', 'div', 'aside', 'body', 'html']
);

console.log('HTML grandparent parser tests passed.');
