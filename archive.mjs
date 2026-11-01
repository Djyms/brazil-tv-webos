import { gzipSync, gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

export function readAr(bytes) {
  assert.equal(bytes.subarray(0,8).toString(),'!<arch>\n');
  const members=new Map();
  for(let offset=8;offset<bytes.length;) {
    const header=bytes.subarray(offset,offset+60).toString();
    assert.equal(header.slice(58),'`\n');
    const name=header.slice(0,16).trim().replace(/\/$/,''),size=Number(header.slice(48,58));
    assert(Number.isSafeInteger(size)&&size>=0&&offset+60+size<=bytes.length);
    members.set(name,bytes.subarray(offset+60,offset+60+size));
    offset+=60+size+size%2;
  }
  return members;
}
export function writeAr(members) {
  const chunks=[Buffer.from('!<arch>\n')];
  for(const [name,data] of members) {
    const header=(name+'/').padEnd(16)+'0'.padEnd(12)+'0'.padEnd(6)+'0'.padEnd(6)+'100644'.padEnd(8)+String(data.length).padEnd(10)+'`\n';
    assert.equal(header.length,60);
    chunks.push(Buffer.from(header),data);
    if(data.length%2)chunks.push(Buffer.from('\n'));
  }
  return Buffer.concat(chunks);
}
export function readTarGz(bytes) {
  const tar=gunzipSync(bytes), entries=[];
  const text=(offset,length)=>tar.subarray(offset,offset+length).toString().replace(/\0.*$/s,'');
  for(let offset=0;offset+512<=tar.length;) {
    const name=text(offset,100);if(!name)break;
    const prefix=text(offset+345,155), path=prefix?`${prefix}/${name}`:name;
    assert(!path.startsWith('/')&&!path.split('/').includes('..'),'Unsafe archive path');
    const size=parseInt(text(offset+124,12),8)||0,mode=parseInt(text(offset+100,8),8)||0o644;
    const type=text(offset+156,1)||'0';
    assert(['0','5'].includes(type),'Unsupported archive member type');
    assert(offset+512+size<=tar.length);
    entries.push({path,mode,type,data:Buffer.from(tar.subarray(offset+512,offset+512+size))});
    offset+=512+Math.ceil(size/512)*512;
  }
  return entries;
}
export function writeTarGz(entries) {
  const chunks=[];
  for(const entry of entries) {
    const header=Buffer.alloc(512),data=entry.type==='5'?Buffer.alloc(0):entry.data;
    let name=entry.path,prefix='';
    if(Buffer.byteLength(name)>100) {
      const cut=name.lastIndexOf('/');prefix=name.slice(0,cut);name=name.slice(cut+1);
    }
    assert(Buffer.byteLength(name)<=100&&Buffer.byteLength(prefix)<=155);
    const octal=(offset,length,value)=>header.write(value.toString(8).padStart(length-1,'0')+'\0',offset,length,'ascii');
    header.write(name,0,100);octal(100,8,entry.mode);octal(108,8,0);octal(116,8,0);
    octal(124,12,data.length);octal(136,12,0);header.fill(32,148,156);
    header.write(entry.type,156);header.write('ustar\0',257);header.write('00',263);
    header.write('root',265);header.write('root',297);header.write(prefix,345,155);
    const sum=header.reduce((total,value)=>total+value,0);
    header.write(sum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
    chunks.push(header,data,Buffer.alloc((512-data.length%512)%512));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks),{level:9});
}
