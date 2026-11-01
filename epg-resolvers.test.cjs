const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const adapter = require('./epg-resolvers.js');

function props() {
  return { context: { channelCode: 'RBA', gridData: { data: {
    channelCode: 'RBA', output: [{ channel: { code: 'RBA' }, slots: [{
      scheduledDate: '2030-01-02T23:30:00-03:00', duration: '01:00:00',
      name: 'Item 1 & <item> "name"', title: { synopsis: "Description 1 & 'detail'" },
    }] }],
  } } } };
}
function html(data = props()) {
  return '<main class="other grade-area" data-props="' + JSON.stringify(data)
    .replace(/&/g, '&amp;').replace(/"/g, '&#34;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"></main>';
}
function rootWith(fetch) { return { fetch, Response, Headers, DOMException }; }

test('converts entity-encoded regional data and escapes all XML text', () => {
  const xml = adapter.convert(html());
  assert.match(xml, /<channel id="TVBahia\.br">/);
  assert.match(xml, /start="20300103023000 \+0000" stop="20300103033000 \+0000"/);
  assert.match(xml, /Item 1 &amp; &lt;item&gt; &quot;name&quot;/);
  assert.match(xml, /Description 1 &amp; &apos;detail&apos;/);
  assert(!xml.includes('<item>'));
});

test('sorts actual schedule times and supports single-quoted reordered attributes', () => {
  const p = props(), day = p.context.gridData.data.output[0];
  day.slots.push({ name: 'Item 2', scheduledDate: '2030-01-02T10:00:00-03:00', duration: '00:30:00' });
  const json = JSON.stringify(p).replace(/&/g, '&amp;').replace(/'/g, '&#x27;');
  const xml = adapter.convert("<main data-props='" + json + "' class='grade-area'></main>");
  assert(xml.indexOf('Item 2') < xml.indexOf('Item 1'));
});

test('rejects every wrong-region marker rather than publishing another guide', () => {
  for (const mutate of [
    p => { p.context.channelCode = 'XYZ'; },
    p => { p.context.gridData.data.channelCode = 'XYZ'; },
    p => { p.context.gridData.data.output[0].channel.code = 'XYZ'; },
  ]) { const p = props(); mutate(p); assert.throws(() => adapter.convert(html(p)), /regional guide/); }
});

test('rejects invalid calendar times, zone, duration and XML control text', () => {
  for (const scheduledDate of ['2030-02-30T23:30:00-03:00', '2030-01-02T24:30:00-03:00', '2030-01-02T23:30:00-02:00', 'invalid']) {
    const p = props(); p.context.gridData.data.output[0].slots[0].scheduledDate = scheduledDate;
    assert.throws(() => adapter.convert(html(p)), /regional guide/);
  }
  for (const duration of ['00:00:00', '00:60:00', '24:00:00', 10]) {
    const p = props(); p.context.gridData.data.output[0].slots[0].duration = duration;
    assert.throws(() => adapter.convert(html(p)), /regional guide/);
  }
  const p = props(); p.context.gridData.data.output[0].slots[0].name = 'Item\u0000';
  assert.throws(() => adapter.convert(html(p)), /regional guide/);
});

test('rejects missing, malformed, empty, duplicated or ambiguous schedules', () => {
  for (const input of ['', '<main class="other"></main>', '<main class="grade-area" data-props="invalid"></main>', html() + html()]) {
    assert.throws(() => adapter.convert(input));
  }
  const empty = props(); empty.context.gridData.data.output[0].slots = [];
  assert.throws(() => adapter.convert(html(empty)), /regional guide/);
  const duplicate = props(); duplicate.context.gridData.data.output[0].slots.push(duplicate.context.gridData.data.output[0].slots[0]);
  assert.throws(() => adapter.convert(html(duplicate)), /regional guide/);
});

test('unrelated URLs, query variants and methods preserve fetch identity and arguments', async () => {
  const calls = [], response = new Response('original');
  const root = rootWith(function () { calls.push({ self: this, args: Array.from(arguments) }); return Promise.resolve(response); });
  adapter.install(root);
  const receiver = {}, options = { method: 'HEAD', headers: { 'x-test': '1' } };
  assert.equal(await root.fetch.call(receiver, adapter.sourceUrl, options), response);
  assert.equal(calls[0].self, receiver); assert.equal(calls[0].args[1], options);
  assert.equal(await root.fetch('https://host/other', options), response);
  assert.equal(await root.fetch(adapter.sourceUrl + '?other=1'), response);
  assert.equal(adapter.install(root), false);
});

test('only exact GET is converted, retaining request options and safe response headers', async () => {
  const controller = new AbortController(), options = { headers: { 'x-test': '1' }, signal: controller.signal };
  let received;
  const root = rootWith((input, init) => { received = { input, init }; return Promise.resolve(new Response(html(), {
    headers: { 'content-type': 'text/html', 'content-length': '123', 'content-encoding': 'gzip', etag: 'original', 'x-source': '1' },
  })); });
  adapter.install(root);
  const request = new Request(adapter.sourceUrl);
  const result = await root.fetch(request, options);
  assert.equal(received.input, request); assert.equal(received.init, options);
  assert.equal(result.headers.get('content-type'), 'application/xml; charset=utf-8');
  assert.equal(result.headers.get('content-length'), null); assert.equal(result.headers.get('content-encoding'), null);
  assert.equal(result.headers.get('etag'), null); assert.equal(result.headers.get('x-source'), '1');
  assert.match(await result.text(), /<programme /);
});

test('HTTP failures and network failures remain failures', async () => {
  const response = new Response('unavailable', { status: 503 });
  const root = rootWith(() => Promise.resolve(response)); adapter.install(root);
  assert.equal(await root.fetch(adapter.sourceUrl), response);
  const broken = rootWith(() => Promise.reject(new Error('network'))); adapter.install(broken);
  await assert.rejects(broken.fetch(adapter.sourceUrl), /network/);
});

test('cancellation before conversion or while reading the body never publishes XML', async () => {
  const controller = new AbortController(); controller.abort();
  const root = rootWith(() => Promise.resolve(new Response(html()))); adapter.install(root);
  await assert.rejects(root.fetch(adapter.sourceUrl, { signal: controller.signal }), { name: 'AbortError' });
  let finish, reading;
  const started = new Promise(resolve => { reading = resolve; });
  const later = new AbortController();
  const deferred = rootWith(() => Promise.resolve({ ok: true, text() { reading(); return new Promise(resolve => { finish = resolve; }); } }));
  adapter.install(deferred);
  const pending = deferred.fetch(adapter.sourceUrl, { signal: later.signal });
  await started; later.abort(); finish(html());
  await assert.rejects(pending, { name: 'AbortError' });
});

test('autoinstalls in a worker without document, DOMParser or window', async () => {
  const root = rootWith(() => Promise.resolve(new Response(html())));
  const original = root.fetch;
  vm.runInNewContext(fs.readFileSync(require.resolve('./epg-resolvers.js'), 'utf8'), { self: root });
  assert.notEqual(root.fetch, original);
  assert.match(await (await root.fetch(adapter.sourceUrl)).text(), /<programme /);
});

test('current official regional HTML converts all 197 verified slots', { skip: !process.env.EPG_BAHIA_HTML }, () => {
  const xml = adapter.convert(fs.readFileSync(process.env.EPG_BAHIA_HTML, 'utf8'));
  assert.equal((xml.match(/<programme /g) || []).length, 197);
  assert(xml.includes('channel="TVBahia.br"'));
});
