const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const preset=JSON.parse(fs.readFileSync(path.join(__dirname,'epg-sources.json'),'utf8'));
const sources=preset.sources.map(x=>x.url);
test('public guide mappings are unique, sourced and contain no private playback links',()=>{
  assert.equal(preset.mappings.length,72);
  assert.equal(new Set(preset.mappings.map(x=>x.name)).size,72);
  assert.equal(new Set(preset.mappings.map(x=>x.xmltvId)).size,72);
  assert.equal(sources.length,4);
  for(const m of preset.mappings){assert(sources.includes(m.sourceUrl));assert(m.xmltvId);assert(!/Globo|Unisul/i.test(m.name));}
});
for(const [file,total,covered] of [['brasil-braziltv.m3u',167,72],['brasil.m3u',164,69]]){
  test(`${file} advertises its guides and uses verified exact programme identifiers`,()=>{
    const lines=fs.readFileSync(path.join(__dirname,file),'utf8').split(/\r?\n/);
    const urls=lines[0].match(/x-tvg-url="([^"]+)"/);assert(urls);
    assert.deepEqual(urls[1].split(','),sources);
    const rows=lines.filter(x=>x.startsWith('#EXTINF'));
    assert.equal(rows.length,total);
    let count=0;
    for(const row of rows){const name=row.slice(row.indexOf(',')+1),m=preset.mappings.find(x=>x.name===name);if(m){assert.equal(row.match(/tvg-id="([^"]*)"/)[1],m.xmltvId);count++;}}
    assert.equal(count,covered);
  });
}
