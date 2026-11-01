const assert=require('node:assert/strict');

module.exports=function(original){
  const marker='function Xv(i,e,t,n=0){return T(this,null,function*(){';
  assert.equal(original.split(marker).length-1,1,'Expected one released channel-health probe');
  assert(!original.includes(marker+'if(t&&t.aborted)'), 'Channel-health probe is already patched');
  const segmentMarker='let o=RI(r);if(!o)';
  assert.equal(original.split(segmentMarker).length-1,1,'Expected one released manifest URI selector');
  // Probe the same resolved source as playback, keeping the original channel key.
  const resolution='if(t&&t.aborted)throw new Error("aborted");if(n===0&&window.__resolveIPTVSource&&window.__resolveIPTVSource.supports(i)){i=yield new Promise(function(resolve,reject){var settled=false;function finish(error,url){if(settled)return;settled=true;if(t)t.removeEventListener("abort",abort);if(error)reject(error);else resolve(url)}function abort(){finish(new Error("aborted"))}if(t){t.addEventListener("abort",abort);if(t.aborted){abort();return}}try{Promise.resolve(window.__resolveIPTVSource(i)).then(function(url){finish(null,url)},function(error){finish(error)})}catch(error){finish(error)}});if(t&&t.aborted)throw new Error("aborted");}';
  // The oldest advertised live segment can already have been removed upstream.
  const segment='let o=r.indexOf("#EXT-X-STREAM-INF:")>=0?RI(r):r.split(/\\r?\\n/).map(function(line){return line.trim()}).filter(function(line){return line&&line.charAt(0)!=="#"}).pop();if(!o)';
  return original.replace(marker,marker+resolution).replace(segmentMarker,segment);
};
