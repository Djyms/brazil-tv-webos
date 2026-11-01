import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import patchPlayer from './patch-player.cjs';
import {readAr,readTarGz} from './archive.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const OLD='com.lennylxx.iptv', ID='com.djyms.braziltv';
const APP=`usr/palm/applications/${ID}/`;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const upstream={url:'https://github.com/lennylxx/webos-iptv-player/releases/download/v1.17.0/com.lennylxx.iptv_1.17.0_all.ipk',sha:'7f38a23df46fedc6381a660b280ce3e8abdeb88aff519f3a41ee3a5c15391299'};
const hls={url:'https://cdn.jsdelivr.net/npm/hls.js@1.6.16/dist/hls.min.js',sha:'442f599c34f103c3355b375a23bdff560592d7117d09a8c847242ea3de2d40e0'};
const hlsLicense={url:'https://raw.githubusercontent.com/video-dev/hls.js/v1.6.16/LICENSE',sha:'ca8773cf798c7ed997d4dd7c8e23c348699f8d5b7462636694cc14de6cda12db'};

async function download(asset) {
  const response=await fetch(asset.url,{signal:AbortSignal.timeout(60000)});
  assert(response.ok,`Download failed: ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(digest(bytes),asset.sha,'Downloaded file failed SHA-256 verification');
  return bytes;
}
const [ipk,hlsBytes,hlsNotice]=await Promise.all([download(upstream),download(hls),download(hlsLicense)]);
const archive=readAr(ipk),data=readTarGz(archive.get('data.tar.gz'));
for(const entry of data) {
  entry.path=entry.path.split(OLD).join(ID);
  if(entry.type==='0'&&/\.(js|json)$/.test(entry.path))
    entry.data=Buffer.from(entry.data.toString().split(OLD).join(ID));
}
const get=name=>{const entry=data.find(e=>e.path===APP+name);assert(entry,`Missing ${name}`);return entry;};
const put=(name,bytes)=>{
  const existing=data.find(e=>e.path===APP+name);
  if(existing)existing.data=Buffer.from(bytes);
  else data.push({path:APP+name,mode:0o644,type:'0',data:Buffer.from(bytes)});
};
const original=get('js/app.js').data.toString();
const patched=patchPlayer(original);
new Function(patched); // Parse only: never execute downloaded app code on the build machine.
put('js/app.js',patched);
for(const entry of data.filter(e=>e.path.startsWith(APP)&&e.path.endsWith('/appinfo.json'))) {
  const manifest=JSON.parse(entry.data.toString());manifest.title='Brazil TV';
  if(manifest.id){manifest.id=ID;manifest.vendor='lennylxx / Djyms';manifest.iconColor='#000000';}
  entry.data=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
}
put('icon.png',await fs.readFile(path.join(root,'icon80.png')));
put('largeIcon.png',await fs.readFile(path.join(root,'icon130.png')));
put('js/brazil-hls.min.js',hlsBytes);put('licenses/brazil-hls.txt',hlsNotice);
put('js/brazil-hls-init.js','window.__Hls = window.Hls;\n');
put('js/brazil-resolvers.js',await fs.readFile(path.join(root,'stream-resolvers.js')));
const epgResolver=await fs.readFile(path.join(root,'epg-resolvers.js'),'utf8');
put('js/brazil-epg-resolvers.js',epgResolver);
put('js/app-worker.js','"use strict";\n'+epgResolver+'\n'+get('js/app-worker.js').data.toString());
put('css/brazil-settings-fix.css',await fs.readFile(path.join(root,'settings-fix.css')));
put('BRAZIL_TV_NOTICE.txt',await fs.readFile(path.join(root,'NOTICE')));
let html=get('index.html').data.toString();
assert.equal(html.split('</head>').length,2);
html=html.replace('</head>','<link rel="stylesheet" href="css/brazil-settings-fix.css">\n</head>');
const appScript=/<script\b[^>]*src=["']js\/app\.js["'][^>]*>/;
assert(appScript.test(html),'Missing main app script');
html=html.replace(appScript,match=>'<script src="js/brazil-hls.min.js"></script>\n<script src="js/brazil-hls-init.js"></script>\n<script src="js/brazil-resolvers.js"></script>\n<script src="js/brazil-epg-resolvers.js"></script>\n'+match);
put('index.html',html);
const dist=path.join(root,'dist');await fs.mkdir(dist,{recursive:true});
const name=`${ID}_1.17.0_all.ipk`;
let packager=process.env.WEBOS_PACKAGE_CLI;
if(!packager) {
  try { packager=createRequire(import.meta.url).resolve('@webos-tools/cli/bin/ares-package'); }
  catch { throw new Error('Install the pinned official webOS CLI with npm ci before building.'); }
}
const payload=await fs.mkdtemp(path.join(root,'.payload-'));
try {
  for(const entry of data.filter(e=>e.path.startsWith(APP)||e.path.startsWith(`usr/palm/services/${ID}.service/`))) {
    const target=path.resolve(payload,entry.path);
    assert(target.startsWith(payload+path.sep),'Unsafe payload path');
    if(entry.type==='5') await fs.mkdir(target,{recursive:true});
    else { await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,entry.data,{mode:entry.mode}); }
  }
  const run=spawnSync(process.execPath,[packager,'--no-minify',path.join(payload,APP),path.join(payload,`usr/palm/services/${ID}.service`),'-o',dist],{encoding:'utf8',windowsHide:true});
  assert.equal(run.status,0,`Official webOS packaging failed: ${run.stderr||run.stdout}`);
} finally {
  const relative=path.relative(root,payload);
  assert(relative.startsWith('.payload-')&&!relative.includes(path.sep),'Unsafe cleanup path');
  await fs.rm(payload,{recursive:true,force:true});
}
const result=await fs.readFile(path.join(dist,name));
await fs.writeFile(path.join(dist,'SHA256SUMS'),`${digest(result)}  ${name}\n`);
await fs.writeFile(path.join(dist,'build-info.json'),JSON.stringify({id:ID,upstreamVersion:'1.17.0',customRevision:2,upstreamSha256:upstream.sha,hlsVersion:'1.6.16',webosCliVersion:'3.2.6',packageSha256:digest(result)},null,2)+'\n');
console.log(`Built ${name}; SHA-256 ${digest(result)}`);
