import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readAr,writeAr,readTarGz,writeTarGz} from './archive.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(root,name));
const ID='com.djyms.braziltv', APP=`usr/palm/applications/${ID}/`;

test('portable archives retain content and permissions',()=>{
  const entries=[{path:'usr/palm/example.txt',mode:0o644,type:'0',data:Buffer.from('example')},
    {path:'usr/palm/bin/helper',mode:0o755,type:'0',data:Buffer.from('helper')}];
  assert.deepEqual(readTarGz(writeTarGz(entries)),entries);
  const members=new Map([['debian-binary',Buffer.from('2.0\n')],['data.tar.gz',writeTarGz(entries)]]);
  assert.deepEqual(readAr(writeAr(members)),members);
});

test('public playlists exclude private addresses, credentials and access tokens',()=>{
  for(const [name,count] of [['brasil.m3u',164],['brasil-braziltv.m3u',167]]) {
    const text=read(name).toString(),lines=text.split(/\r?\n/);
    assert(text.startsWith('#EXTM3U\n'));
    assert.equal(lines.filter(l=>l.startsWith('#EXTINF')).length,count);
    const urls=lines.filter(l=>/^https?:/.test(l));assert.equal(urls.length,count);
    for(const line of urls) {
      const url=new URL(line);
      assert(!url.username&&!url.password);
      assert(!/^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname));
      assert(![...url.searchParams.keys()].some(k=>/token|secret|password|session|jwt/i.test(k)));
      assert.notEqual(url.hostname,'hls1.sua.tv');
      if(name==='brasil.m3u')assert(!/\/cache\/config\/|\/player\/metadata\//.test(url.pathname));
    }
  }
});

test('release has its own application and service identity and preserves notices',()=>{
  const bytes=read(`dist/${ID}_1.17.0_all.ipk`),ar=readAr(bytes);
  const files=readTarGz(ar.get('data.tar.gz'));
  const get=name=>{const entry=files.find(f=>f.path===APP+name);assert(entry,`Missing ${name}`);return entry.data.toString();};
  assert.equal(JSON.parse(get('appinfo.json')).id,ID);
  assert.equal(JSON.parse(get('appinfo.json')).title,'Brazil TV');
  assert(files.some(f=>f.path===`usr/palm/services/${ID}.service/services.json`));
  assert(files.every(f=>!f.path.includes('com.lennylxx.iptv')));
  for(const f of files.filter(f=>/\.(js|json)$/.test(f.path)))assert(!f.data.includes(Buffer.from('com.lennylxx.iptv')));
  for(const name of ['LICENSE','THIRD_PARTY_NOTICES.txt','BRAZIL_TV_NOTICE.txt','licenses/brazil-hls.txt'])assert(get(name).length>100);
  for(const f of files.filter(f=>/\/resources\/[^/]+\/appinfo\.json$/.test(f.path)))assert.equal(JSON.parse(f.data.toString()).title,'Brazil TV');
  assert.equal(read('dist/SHA256SUMS').toString().split(' ')[0],createHash('sha256').update(bytes).digest('hex'));
});

test('startup, playback and settings modifications are included once',()=>{
  const files=readTarGz(readAr(read(`dist/${ID}_1.17.0_all.ipk`)).get('data.tar.gz'));
  const get=name=>files.find(f=>f.path===APP+name).data.toString();
  const js=get('js/app.js'),html=get('index.html');
  new Function(js);
  assert(js.includes('if(yield this.startBundledService())yield this.settings.refreshUploads()'));
  assert(js.includes('!this.loadingData&&N.channels.length===0'));
  assert(js.includes('window.__resolveIPTVSource.supports(e)'));
  assert.equal(html.split('src="js/brazil-resolvers.js"').length,2);
  assert(html.indexOf('js/brazil-resolvers.js')<html.indexOf('src="js/app.js"'));
  assert(get('css/brazil-settings-fix.css').includes('minmax(0, 1fr)'));
});
