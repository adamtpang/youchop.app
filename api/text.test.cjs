const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeCaptionText } = require("./text");

test("caption entities become literal text without treating markup as HTML", () => {
  assert.equal(decodeCaptionText("I&#39;m &amp; you&#x27;re &quot;ready&quot; &#128512;"), `I'm & you're "ready" 😀`);
  assert.equal(decodeCaptionText("&lt;script&gt;x&lt;/script&gt;"), "<script>x</script>");
  assert.equal(decodeCaptionText("&#999999999; &#0; &#xD800; &unknown;"), "&#999999999; &#0; &#xD800; &unknown;");
});
