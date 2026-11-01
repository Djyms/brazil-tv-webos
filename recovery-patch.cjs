const assert = require('node:assert/strict');

module.exports = function patchLiveRecovery(original) {
  const declaration = 'l=e==="timeout"&&!this.vod,c=["reason=".concat(e),"handled=".concat(l?"deferred":"error")';
  const verdict = 'this.startupPending=!1,this.onError("unsupported")}applyPipelineManifest(e)';
  assert.equal(original.split(declaration).length - 1, 1, 'Expected one startup verdict declaration');
  assert.equal(original.split(verdict).length - 1, 1, 'Expected one startup failure handler');
  return original.replace(declaration,
    'l=e==="timeout"&&!this.vod,brazilLiveRetry=e==="unsupported"&&this.liveSessionActive&&!this.vod&&!this.catchupInfo&&!!s&&!!a&&!!s.canPlayType(a)&&!(s.error&&s.error.code===4),c=["reason=".concat(e),"handled=".concat(l?"deferred":brazilLiveRetry?"retry":"error")')
    .replace(verdict,
      'this.startupPending=!1,this.onError(brazilLiveRetry?void 0:"unsupported")}applyPipelineManifest(e)');
};
