(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.install(root);
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var SOURCE_URL = 'https://redeglobo.globo.com/redebahia/programacao/';
  var CHANNEL_ID = 'TVBahia.br';

  function fail() { throw new Error('Official regional guide is invalid'); }

  function decodeAttribute(value) {
    return value.replace(/&(#x[0-9a-f]+|#[0-9]+|quot|apos|amp|lt|gt);/gi, function (entity, key) {
      var names = { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' };
      var point;
      if (key.charAt(0) !== '#') return names[key.toLowerCase()];
      point = key.charAt(1).toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      if (point <= 0 || point > 1114111 || (point >= 55296 && point <= 57343)) fail();
      if (point < 65536) return String.fromCharCode(point);
      point -= 65536;
      return String.fromCharCode(55296 + (point >> 10), 56320 + (point & 1023));
    });
  }

  function propsFromHtml(html) {
    if (typeof html !== 'string' || html.length > 5 * 1024 * 1024) fail();
    var tags = html.match(/<main\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) || [];
    var found = null;
    var i, match, attrs, re;
    for (i = 0; i < tags.length; i++) {
      attrs = {};
      re = /\b([a-z][a-z0-9:_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
      while ((match = re.exec(tags[i]))) {
        var key = match[1].toLowerCase();
        if (Object.prototype.hasOwnProperty.call(attrs, key)) fail();
        attrs[key] = match[2] === undefined ? match[3] : match[2];
      }
      if (!attrs['class'] || (' ' + attrs['class'].replace(/\s+/g, ' ') + ' ').indexOf(' grade-area ') < 0) continue;
      if (found !== null || !attrs['data-props']) fail();
      found = attrs['data-props'];
    }
    if (found === null) fail();
    return JSON.parse(decodeAttribute(found));
  }

  function xml(value) {
    var s = String(value), i, code, next;
    for (i = 0; i < s.length; i++) {
      code = s.charCodeAt(i);
      if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 65534 || code === 65535) fail();
      if (code >= 55296 && code <= 56319) {
        next = s.charCodeAt(++i);
        if (!(next >= 56320 && next <= 57343)) fail();
      } else if (code >= 56320 && code <= 57343) fail();
    }
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function parseDate(value) {
    if (typeof value !== 'string') fail();
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})-03:00$/.exec(value);
    if (!m) fail();
    var year = +m[1], month = +m[2], day = +m[3], hour = +m[4], minute = +m[5], second = +m[6];
    if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) fail();
    var local = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) fail();
    return local.getTime() + 3 * 60 * 60 * 1000;
  }

  function duration(value) {
    if (typeof value !== 'string') fail();
    var m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
    if (!m || +m[1] > 23 || +m[2] > 59 || +m[3] > 59) fail();
    var seconds = +m[1] * 3600 + +m[2] * 60 + +m[3];
    if (!seconds) fail();
    return seconds * 1000;
  }

  function stamp(time) {
    function two(n) { return n < 10 ? '0' + n : String(n); }
    var d = new Date(time);
    return String(d.getUTCFullYear()) + two(d.getUTCMonth() + 1) + two(d.getUTCDate()) + two(d.getUTCHours()) + two(d.getUTCMinutes()) + two(d.getUTCSeconds()) + ' +0000';
  }

  function convert(html) {
    var props = propsFromHtml(html);
    var context = props && props.context;
    var data = context && context.gridData && context.gridData.data;
    if (!context || context.channelCode !== 'RBA' || !data || data.channelCode !== 'RBA' || !Array.isArray(data.output) || !data.output.length || data.output.length > 32) fail();
    var programmes = [], starts = {}, i, j, day, slot, start, stop, description;
    for (i = 0; i < data.output.length; i++) {
      day = data.output[i];
      if (!day || !day.channel || day.channel.code !== 'RBA' || !Array.isArray(day.slots)) fail();
      for (j = 0; j < day.slots.length; j++) {
        slot = day.slots[j];
        if (!slot || typeof slot.name !== 'string' || !slot.name.trim() || slot.name.length > 4096) fail();
        start = parseDate(slot.scheduledDate);
        stop = start + duration(slot.duration);
        if (starts[start] || programmes.length >= 5000) fail();
        starts[start] = true;
        description = slot.title && slot.title.synopsis;
        if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 32768)) fail();
        programmes.push({ start: start, stop: stop, title: slot.name, description: description || '' });
      }
    }
    if (!programmes.length) fail();
    programmes.sort(function (a, b) { return a.start - b.start; });
    var result = '<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="Brazil TV official regional guide">\n<channel id="' + CHANNEL_ID + '"><display-name>TV Bahia</display-name></channel>\n';
    for (i = 0; i < programmes.length; i++) {
      var p = programmes[i];
      result += '<programme channel="' + CHANNEL_ID + '" start="' + stamp(p.start) + '" stop="' + stamp(p.stop) + '"><title>' + xml(p.title) + '</title>';
      if (p.description) result += '<desc>' + xml(p.description) + '</desc>';
      result += '</programme>\n';
    }
    return result + '</tv>\n';
  }

  function abortError(root) {
    if (typeof root.DOMException === 'function') return new root.DOMException('The operation was aborted', 'AbortError');
    var error = new Error('The operation was aborted');
    error.name = 'AbortError';
    return error;
  }

  function install(root) {
    if (!root || typeof root.fetch !== 'function' || typeof root.Response !== 'function' || typeof root.Headers !== 'function' || root.fetch.__brazilEpgResolver) return false;
    var nativeFetch = root.fetch;
    function wrapped(input, options) {
      var url = typeof input === 'string' ? input : input && (input.url || input.href);
      var method = options && options.method || input && input.method || 'GET';
      if (url !== SOURCE_URL || String(method).toUpperCase() !== 'GET') return nativeFetch.apply(this, arguments);
      var signal = options && options.signal || input && input.signal;
      return nativeFetch.apply(this, arguments).then(function (response) {
        if (!response.ok) return response;
        if (signal && signal.aborted) throw abortError(root);
        return response.text().then(function (html) {
          if (signal && signal.aborted) throw abortError(root);
          var body = convert(html);
          if (signal && signal.aborted) throw abortError(root);
          var headers = new root.Headers(response.headers);
          headers.set('content-type', 'application/xml; charset=utf-8');
          headers.delete('content-length');
          headers.delete('content-encoding');
          headers.delete('etag');
          return new root.Response(body, { status: response.status, statusText: response.statusText, headers: headers });
        });
      });
    }
    wrapped.__brazilEpgResolver = true;
    root.fetch = wrapped;
    return true;
  }

  return { sourceUrl: SOURCE_URL, channelId: CHANNEL_ID, convert: convert, install: install };
});
