const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const patchHealth=require('./health-patch.cjs');

// The released probe, isolated from the v1.17.0 bundle with its original dependencies.
const probe='function Xv(i,e,t,n=0){return T(this,null,function*(){let s=yield OI(i,e,t),r=new TextDecoder().decode(s.bytes).replace(/^\\uFEFF/,"").replace(/^\\s+/,""),a=r.slice(0,64).toLowerCase();if(s.contentType.indexOf("text/html")>=0||s.contentType.indexOf("application/json")>=0||a.indexOf("<!doctype html")===0||a.indexOf("<html")===0||a.indexOf(\'{"\')===0)throw new Error("invalid_content");if(r.indexOf("<")===0&&!Dn(r))throw new Error("invalid_content");if(r.indexOf("#EXTM3U")!==0)return;if(n>=I.CHANNEL_HEALTH.MAX_MANIFEST_DEPTH)throw new Error("manifest_depth");let o=RI(r);if(!o)throw new Error("empty_manifest");yield Xv(MI(o,s.url),e,t,n+1)})}';
function T(self,args,fn){return new Promise((resolve,reject)=>{const gen=fn.apply(self,args||[]);function step(method,value){let result;try{result=gen[method](value);}catch(error){reject(error);return;}if(result.done)resolve(result.value);else Promise.resolve(result.value).then(v=>step('next',v),e=>step('throw',e));}step('next');});}
function makeProbe({resolver,request,patched=true,depth=3}={}){
  const calls=[];
  const context={T,TextDecoder,Promise,Error,window:{__resolveIPTVSource:resolver},I:{CHANNEL_HEALTH:{MAX_MANIFEST_DEPTH:depth}},
    OI:async(url,headers,signal)=>{calls.push({url,headers,signal});return request(url,headers,signal);},
    MI:(url,base)=>new URL(url,base).toString(),
    RI:text=>text.split(/\r?\n/).find(line=>line.trim()&&!line.startsWith('#'))||'',Dn:()=>false};
  const run=vm.runInNewContext((patched?patchHealth(probe):probe)+';Xv',context);
  return {run,calls};
}
const response=(url,text,type='application/vnd.apple.mpegurl')=>({url,bytes:new TextEncoder().encode(text),contentType:type});
function resolverTo(url){const resolver=async()=>url;resolver.supports=input=>input==='http://host/metadata';return resolver;}

test('metadata response reproduces the original false failure',async()=>{
  const {run}=makeProbe({patched:false,request:async url=>response(url,'{"sources":[]}','application/json')});
  await assert.rejects(run('http://host/metadata',{}),/invalid_content/);
});

test('resolved metadata is checked through manifest and media with original headers and signal',async()=>{
  const headers={Referer:'http://host/page'},signal=new AbortController().signal;
  const {run,calls}=makeProbe({resolver:resolverTo('http://host/live/master.m3u8'),request:async url=>{
    if(url==='http://host/metadata')return response(url,'{"sources":[]}','application/json');
    if(url.endsWith('/master.m3u8'))return response(url,'#EXTM3U\nvariant.m3u8');
    if(url.endsWith('/variant.m3u8'))return response(url,'#EXTM3U\nsegment.ts');
    return response(url,'media bytes','video/mp2t');
  }});
  await run('http://host/metadata',headers,signal);
  assert.deepEqual(calls.map(call=>call.url),['http://host/live/master.m3u8','http://host/live/variant.m3u8','http://host/live/segment.ts']);
  assert(calls.every(call=>call.headers===headers&&call.signal===signal));
});

test('direct sources do not call the metadata resolver',async()=>{
  let resolutions=0;const resolver=resolverTo('http://host/unused');
  const wrapped=async url=>{resolutions++;return resolver(url);};wrapped.supports=resolver.supports;
  const {run,calls}=makeProbe({resolver:wrapped,request:async url=>response(url,'media bytes','video/mp2t')});
  await run('http://host/direct',{});
  assert.equal(resolutions,0);assert.equal(calls[0].url,'http://host/direct');
});

test('denied or malformed resolved sources remain failures',async()=>{
  const resolver=async()=>{throw new Error('denied');};resolver.supports=()=>true;
  const denied=makeProbe({resolver,request:async()=>{throw new Error('unexpected request');}});
  await assert.rejects(denied.run('http://host/metadata',{}),/denied/);assert.equal(denied.calls.length,0);
  const invalid=makeProbe({resolver:resolverTo('http://host/error'),request:async url=>response(url,'<html>error','text/html')});
  await assert.rejects(invalid.run('http://host/metadata',{}),/invalid_content/);
});

test('abort during resolution stops the check before any media request',async()=>{
  const controller=new AbortController();let finish;
  const resolver=()=>new Promise(resolve=>{finish=resolve;});resolver.supports=()=>true;
  const {run,calls}=makeProbe({resolver,request:async url=>response(url,'media bytes')});
  const pending=run('http://host/metadata',{},controller.signal);
  controller.abort();await assert.rejects(pending,/aborted/);
  finish('http://host/late');await Promise.resolve();assert.equal(calls.length,0);
});

test('a pre-aborted check never resolves or requests a source',async()=>{
  const controller=new AbortController();controller.abort();let resolutions=0;
  const resolver=async()=>{resolutions++;return 'http://host/live';};resolver.supports=()=>true;
  const {run,calls}=makeProbe({resolver,request:async url=>response(url,'media bytes')});
  await assert.rejects(run('http://host/metadata',{},controller.signal),/aborted/);
  assert.equal(resolutions,0);assert.equal(calls.length,0);
});

test('resolution does not consume manifest depth or recur for child manifests',async()=>{
  let resolutions=0;const resolver=async()=>{resolutions++;return 'http://host/master';};resolver.supports=()=>true;
  const {run}=makeProbe({resolver,depth:1,request:async url=>response(url,url.endsWith('/master')?'#EXTM3U\nmedia':'media bytes')});
  await run('http://host/metadata',{});assert.equal(resolutions,1);
  const capped=makeProbe({resolver,depth:0,request:async url=>response(url,'#EXTM3U\nmedia')});
  await assert.rejects(capped.run('http://host/metadata',{}),/manifest_depth/);
});

test('a live media probe uses the latest complete segment when the oldest is gone',async()=>{
  const request=async url=>{
    if(url==='http://host/live.m3u8')return response(url,'#EXTM3U\n#EXTINF:6,\nold.ts\n#EXTINF:6,\nnew.ts\n#EXT-X-PART:DURATION=1,URI="partial.ts"\n');
    if(url.endsWith('/old.ts'))throw new Error('http_404');
    assert.equal(url,'http://host/new.ts');
    return response(url,'media bytes','video/mp2t');
  };
  const original=makeProbe({patched:false,request});
  await assert.rejects(original.run('http://host/live.m3u8',{}),/http_404/);
  const fixed=makeProbe({request});
  await fixed.run('http://host/live.m3u8',{});
  assert.deepEqual(fixed.calls.map(call=>call.url),['http://host/live.m3u8','http://host/new.ts']);
});

test('a master playlist still selects its first variant',async()=>{
  const {run,calls}=makeProbe({request:async url=>{
    if(url==='http://host/master.m3u8')return response(url,'#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nfirst.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000\nsecond.m3u8');
    if(url==='http://host/first.m3u8')return response(url,'#EXTM3U\n#EXTINF:6,\nold.ts\n#EXTINF:6,\nnew.ts');
    assert.equal(url,'http://host/new.ts');return response(url,'media bytes','video/mp2t');
  }});
  await run('http://host/master.m3u8',{});
  assert.deepEqual(calls.map(call=>call.url),['http://host/master.m3u8','http://host/first.m3u8','http://host/new.ts']);
});

test('empty media manifests remain a failed check',async()=>{
  const {run}=makeProbe({request:async url=>response(url,'#EXTM3U\n#EXT-X-PART:DURATION=1,URI="partial.ts"\n')});
  await assert.rejects(run('http://host/empty.m3u8',{}),/empty_manifest/);
});

test('health patch rejects an already patched or changed probe',()=>{
  assert.throws(()=>patchHealth(patchHealth(probe)),/already patched/);
  assert.throws(()=>patchHealth(''),/released channel-health probe/);
});

test('patch matches the released bundle without changing health identities',{skip:!process.env.IPTV_UPSTREAM_IPK},async()=>{
  const {readAr,readTarGz}=await import('./archive.mjs');
  const files=readTarGz(readAr(fs.readFileSync(process.env.IPTV_UPSTREAM_IPK)).get('data.tar.gz'));
  const original=files.find(file=>file.path.endsWith('/js/app.js')).data.toString();
  assert(original.includes(probe));
  const patched=patchHealth(original);new Function(patched);
  assert(patched.includes('let m=Y(g),f=this.data()[m],w=Date.now();try{if(yield Xv(g.url,'));
});
