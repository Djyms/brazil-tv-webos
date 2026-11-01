const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const patch = require('./recovery-patch.cjs');

let baseline;
before(async () => {
  const { readAr, readTarGz } = await import('./archive.mjs');
  const ipk = fs.readFileSync(path.join(__dirname, 'dist/com.djyms.braziltv_1.17.0_all.ipk'));
  const files = readTarGz(readAr(ipk).get('data.tar.gz'));
  baseline = files.find(f => f.path.endsWith('/js/app.js')).data.toString()
    .replace('brazilLiveRetry=e==="unsupported"&&this.liveSessionActive&&!this.vod&&!this.catchupInfo&&!!s&&!!a&&!!s.canPlayType(a)&&!(s.error&&s.error.code===4),', '')
    .replace('l?"deferred":brazilLiveRetry?"retry":"error"', 'l?"deferred":"error"')
    .replace('this.onError(brazilLiveRetry?void 0:"unsupported")', 'this.onError("unsupported")');
});

function harness(bundle, options = {}) {
  const timers = [];
  const logger = { warn() {}, error() {} };
  function extract(start, end) {
    const offset = bundle.indexOf(start);
    assert(offset >= 0, `Missing ${start}`);
    return bundle.slice(offset, bundle.indexOf(end, offset));
  }
  const methods = extract('onStartupFailure(e,t,n){', 'applyPipelineManifest(e)')
    + extract('onError(e){', 'markLiveUnavailable(e){');
  const factory = new Function('Ce', 'ai', 'Es', 'J', 'p', 'jt', 'setTimeout',
    `return class {${methods}}`);
  const Player = factory(logger, () => 'm3u8', value => value, () => {}, x => x,
    () => false, callback => { timers.push(callback); return timers.length; });
  const watchdogCode = extract('var Yl=class', ';var Ql=class').slice('var Yl='.length);
  const Watchdog = new Function('clearInterval', `return (${watchdogCode})`)(() => {});
  const player = new Player();
  const state = { reloads: 0, failures: 0, advances: 0 };
  Object.assign(player, {
    playbackActive: true, wasPlayingBeforeHide: false, errorAdvanceTimer: null,
    liveSessionActive: true, vod: null, catchupInfo: null, currentChannel: {},
    startupPending: true,
    videoEl: {
      currentSrc: 'http://host/live.m3u8', currentTime: 0, readyState: 0, networkState: 3,
      error: options.code4 ? { code: 4 } : null,
      querySelector: () => ({ getAttribute: () => 'application/vnd.apple.mpegurl' }),
      canPlayType: () => options.rejected ? '' : 'maybe',
    },
    cancelLiveHistoryTimer() {}, onPlaybackStateChanged() {}, playbackLabel: () => '',
    mediaState: () => '', osd: { updateMessage() {} },
    markLiveUnavailable() { state.failures++; }, channelUp() { state.advances++; },
  });
  if (options.catchup) player.catchupInfo = {};
  if (options.vod) player.vod = { title: 'Item 1', onBack() { state.advances++; } };
  player.stop = () => {};
  player.stallWatchdog = new Watchdog({
    probe: () => ({ currentTime: 0 }), maxReloads: 3,
    onReload() { state.reloads++; },
    onEscalate() { player.markLiveUnavailable(); player.channelUp(); },
  });
  player.stallWatchdog.start(false);
  return { player, state, flush() { while (timers.length) timers.shift()(); } };
}

function recover(bundle) {
  const h = harness(bundle);
  h.player.stallWatchdog.recoverFromError();
  for (let attempt = 0; attempt < 3 && h.state.failures === 0; attempt++) {
    h.player.onStartupFailure('unsupported', { readyState: 0, networkState: 3 }, 1000);
    h.flush();
    if (attempt < 2 && /brazilLiveRetry/.test(bundle)) assert.equal(h.state.failures, 0);
  }
  return h.state;
}

test('real released methods exhaust the configured budget only with the fix', () => {
  assert.deepEqual(recover(baseline), { reloads: 1, failures: 1, advances: 1 });
  assert.deepEqual(recover(patch(baseline)), { reloads: 3, failures: 1, advances: 1 });
});

test('real code4, rejected MIME, VOD and catchup retain terminal behavior', () => {
  for (const options of [{ code4: true }, { rejected: true }, { vod: true }, { catchup: true }]) {
    const h = harness(patch(baseline), options);
    h.player.onStartupFailure('unsupported', { readyState: 0, networkState: 3 }, 1000);
    h.flush();
    assert.equal(h.state.reloads, 0);
    assert.equal(h.state.advances, 1);
  }
});

test('patch refuses a changed or already patched upstream bundle', () => {
  const fixed = patch(baseline);
  new Function(fixed);
  assert.throws(() => patch(fixed), /startup verdict/);
  assert.throws(() => patch(''), /startup verdict/);
});
