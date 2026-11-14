import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {load} from 'cheerio';
import {build,barChart} from '../scripts/build.mjs';
import {validateHtml} from '../scripts/validate.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function fixture(fn){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'project-doc-test-'));try{await fn(dir);}finally{await fs.rm(dir,{recursive:true,force:true});}}

test('runnable example: offline diagrams, accessible values and nested details survive rendering',()=>fixture(async dir=>{
  const output=path.join(dir,'doc.html');const r=await build(path.join(root,'examples/minimal/document.json'),output);
  assert.equal(r.passed,true);assert.equal(r.diagrams,1);assert.equal(r.charts,1);
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
  assert.throws(()=>barChart({...base,data:[{label:'A',value:-1}]}),/nonnegative/);
  assert.throws(()=>barChart({...base,data:[{label:'A',value:NaN}]}),/finite/);
  assert.throws(()=>barChart({...base,data:[{label:'A',value:1},{label:'A',value:2}]}),/unique/);
});

test('validator rejects runtime/asset dependencies and broken navigation',()=>{
  const result=validateHtml('<!DOCTYPE html><html lang="en"><head><title>Test</title><style>@import url(https://example.com/font);</style></head><body><h1>Title</h1><a href="#absent">Link</a><img src="https://example.com/a.png"><script>fetch("https://example.com")</script></body></html>');
  assert.equal(result.passed,false);assert.ok(result.errors.some(e=>e.includes('Broken anchor')));assert.ok(result.errors.some(e=>e.includes('CSS')));assert.ok(result.errors.some(e=>e.includes('network')));assert.ok(result.errors.some(e=>e.includes('Non-embedded')));
});
