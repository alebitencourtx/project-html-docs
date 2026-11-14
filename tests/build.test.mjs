import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {load} from 'cheerio';
import {build,barChart} from '../scripts/build.mjs';
import {validateHtml} from '../scripts/validate.mjs';
import {verify} from '../scripts/verify.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function fixture(fn){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'project-doc-test-'));try{await fn(dir);}finally{await fs.rm(dir,{recursive:true,force:true});}}

test('runnable example: offline diagrams, accessible values and nested details survive rendering',()=>fixture(async dir=>{
  const output=path.join(dir,'doc.html');const r=await build(path.join(root,'examples/minimal/document.json'),output);
  assert.equal(r.passed,true);assert.equal(r.diagrams,1);assert.equal(r.charts,1);
  assert.equal(r.contentSections,3);assert.equal(r.referenceBlocks,0);
  assert.ok(r.builtAt);assert.ok(r.manifestSha256);assert.ok(r.skillVersion);
  const html=await fs.readFile(output,'utf8');const $=load(html);
  assert.equal($('details').filter((_,e)=>$(e).find('summary').first().text()==='Example query').find('pre').length,1);
  assert.equal($('.chart tbody tr').length,2);
  assert.equal($('.diagram svg g.node').length,4);
  assert.ok(!html.includes('@import'));assert.ok(!html.includes('fonts.googleapis.com'));
  await assert.rejects(()=>build(path.join(root,'examples/minimal/document.json'),output),/already exists/);
  assert.equal(await fs.readFile(output,'utf8'),html);
  await build(path.join(root,'examples/minimal/document.json'),output,{force:true});
}));

test('multiple SVGs namespace marker identifiers; unsafe Markdown HTML cannot execute',()=>fixture(async dir=>{
  const spec={title:'Test',subtitle:'Test document',version:'1',updated:'2026-11-14',content:'content.md',sections:[{id:'flow',title:'Flow',audience:'all'}]};
  await fs.writeFile(path.join(dir,'document.json'),JSON.stringify(spec));
  await fs.writeFile(path.join(dir,'content.md'),'## Flow\n\n<script>alert(1)</script>\n\n<div onclick="alert(2)">Text</div>\n\n```mermaid First view\nflowchart LR\n A[One] --> B[Two]\n```\n\n```mermaid Second view\nflowchart TD\n C[Three] --> D[Four]\n```\n');
  const out=path.join(dir,'output.html');await build(path.join(dir,'document.json'),out);const html=await fs.readFile(out,'utf8');
  assert.equal(validateHtml(html).diagrams,2);assert.ok(!html.includes('alert(1)'));assert.ok(!html.includes('onclick='));
  const $=load(html);const ids=$('[id]').map((_,e)=>$(e).attr('id')).get();assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.includes('diagram-1-arrowhead'));assert.ok(ids.includes('diagram-2-arrowhead'));
}));

test('content/manifest mismatch fails without creating an output',()=>fixture(async dir=>{
  await fs.writeFile(path.join(dir,'content.md'),'## Different\n\nText');
  await fs.writeFile(path.join(dir,'document.json'),JSON.stringify({title:'Test',subtitle:'Test',version:'1',updated:'2026-11-14',content:'content.md',sections:[{id:'x',title:'Expected',audience:'all'}]}));
  const out=path.join(dir,'out.html');await assert.rejects(()=>build(path.join(dir,'document.json'),out),/headings must match/);await assert.rejects(()=>fs.access(out));
}));

test('chart rejects misleading values and duplicate categories; zero remains zero',()=>{
  const base={type:'bar',title:'Count',unit:'rows',source:'Fixture',data:[{label:'A',value:0},{label:'B',value:10}]};
  const $=load(barChart(base));assert.equal($('tbody tr').first().find('td').last().text(),'0');
  assert.equal($('[data-zero="true"]').length,1);
  assert.throws(()=>barChart({...base,data:[{label:'A',value:-1}]}),/nonnegative/);
  assert.throws(()=>barChart({...base,data:[{label:'A',value:NaN}]}),/finite/);
  assert.throws(()=>barChart({...base,data:[{label:'A',value:1},{label:'A',value:2}]}),/unique/);
});

test('chart keeps a 45-character label inside the SVG and marks zero',()=>{
  const data=[{label:'R'.repeat(45),value:5},{label:'Zero',value:0}];
  const $=load(barChart({type:'bar',title:'Long label',unit:'rows',source:'Fixture',data}));
  const x=Number($('text[text-anchor="end"]').first().attr('x'));
  assert.ok(x>0,`label x should stay inside the viewBox, got ${x}`);
  assert.equal($('[data-zero="true"]').length,1);
  assert.match($('svg').attr('style'),/min-width:\d+px/);
  const wide=load(barChart({type:'bar',title:'Wide label',unit:'rows',source:'Fixture',data:[{label:'W'.repeat(45),value:5}]}));
  assert.ok(Number(wide('text[text-anchor="end"]').first().attr('x'))>=600);
});

test('validator rejects runtime/asset dependencies and broken navigation',()=>{
  const result=validateHtml('<!DOCTYPE html><html lang="en"><head><title>Test</title><style>@import url(https://example.com/font);</style></head><body><h1>Title</h1><a href="#absent">Link</a><img src="https://example.com/a.png"><script>fetch("https://example.com")</script></body></html>');
  assert.equal(result.passed,false);assert.ok(result.errors.some(e=>e.includes('Broken anchor')));assert.ok(result.errors.some(e=>e.includes('CSS')));assert.ok(result.errors.some(e=>e.includes('network')));assert.ok(result.errors.some(e=>e.includes('Non-embedded')));
});

test('validator rejects incomplete structures and inline external styles',()=>{
  const result=validateHtml('<!DOCTYPE html><html lang="pt-BR"><head><title>T</title></head><body><h1>T</h1><h2>S</h2><h4>Jump</h4><table><tr><td>x</td></tr></table><details><p>x</p></details><figure><svg aria-label="x"></svg></figure><a href="#x"></a><div style="background:url(https://example.com/a.png)"></div><p id="x">x</p></body></html>');
  assert.equal(result.passed,false);
  const joined=result.errors.join(' ');
  assert.match(joined,/Table missing header cells/);
  assert.match(joined,/Details missing a single summary/);
  assert.match(joined,/H4 without H3/);
  assert.match(joined,/Figure missing figcaption/);
  assert.match(joined,/External inline style resource/);
  assert.match(joined,/Link without text/);
});

test('verify detects changed sources and receipt drift',()=>fixture(async dir=>{
  const repo=path.join(dir,'repo');await fs.mkdir(repo);
  await fs.writeFile(path.join(repo,'a.txt'),'one');
  const manifest={title:'T',subtitle:'S',version:'1',updated:'2026-11-14',content:'c.md',repoRoot:'repo',sections:[{id:'a',title:'A',audience:'all'}],sources:[{id:'a',path:'a.txt',description:'a'}]};
  await fs.writeFile(path.join(dir,'document.json'),JSON.stringify(manifest));
  const sha=createHash('sha256').update('one').digest('hex');
  const receipt={revision:null,sources:[{id:'a',path:'a.txt',description:'a',sha256:sha}]};
  await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify(receipt));
  let result=await verify(path.join(dir,'document.json'),path.join(dir,'receipt.json'));
  assert.equal(result.ok,true);
  await fs.writeFile(path.join(repo,'a.txt'),'two');
  result=await verify(path.join(dir,'document.json'),path.join(dir,'receipt.json'));
  assert.equal(result.ok,false);
  assert.equal(result.sources[0].status,'changed');
}));
