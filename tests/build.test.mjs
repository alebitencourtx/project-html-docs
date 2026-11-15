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
  assert.equal($('#dialog-fit').length,1);
  assert.equal($('#dialog-actual').length,1);
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

test('chart features: semantic variants, accessible row titles, value proximity, dignified zero, and grid scale',()=>{
  const spec={
    type:'bar',
    title:'Performance metrics',
    unit:'ms',
    source:'Bench',
    data:[
      {label:'Fast',value:100,variant:'success'},
      {label:'Warning',value:75,variant:'warning'},
      {label:'Critical',value:50,variant:'danger'},
      {label:'Background',value:25,variant:'neutral'},
      {label:'Normal',value:10,variant:'accent'},
      {label:'Empty',value:0}
    ]
  };
  const $=load(barChart(spec));

  assert.equal($('g.chart-row:has(text.chart-label:contains("Fast")) rect.chart-bar').attr('fill'),'#16a34a');
  assert.equal($('g.chart-row:has(text.chart-label:contains("Warning")) rect.chart-bar').attr('fill'),'#d97706');
  assert.equal($('g.chart-row:has(text.chart-label:contains("Critical")) rect.chart-bar').attr('fill'),'#dc2626');
  assert.equal($('g.chart-row:has(text.chart-label:contains("Background")) rect.chart-bar').attr('fill'),'#64748b');
  assert.equal($('g.chart-row:has(text.chart-label:contains("Normal")) rect.chart-bar').attr('fill'),'#087f8c');
  assert.throws(()=>barChart({...spec,data:[{label:'X',value:1,variant:'unknown'}]}),/variant/);

  assert.equal($('g.chart-row').length,6);
  assert.equal($('g.chart-row title').first().text(),'Fast: 100 ms');
  assert.equal($('g.chart-row title').last().text(),'Empty: 0 ms');

  const zeroBadge=$('[data-zero="true"]');
  assert.equal(zeroBadge.length,1);
  assert.match(zeroBadge.text(),/0\s*\(zero\)/);

  const fastVal=$('g.chart-row:has(text.chart-label:contains("Fast")) text.chart-value-inside');
  assert.equal(fastVal.length,1);
  assert.equal(fastVal.attr('fill'),'#ffffff');

  const normalRow=$('g.chart-row:has(text.chart-label:contains("Normal"))');
  assert.equal(normalRow.find('text.chart-value-outside').length,1);
  assert.equal(normalRow.find('line.chart-guide').length,1);

  assert.equal($('line.chart-gridline').length,4);
  const axisVals=$('text.chart-axis-val').map((_,e)=>$(e).text()).get();
  assert.deepEqual(axisVals,['0','25','50','75','100']);
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

test('validator rejects raw LaTeX math in prose/tables while allowing currency and code blocks',()=>{
  const base=(body)=>`<!DOCTYPE html><html lang="pt-BR"><head><title>T</title></head><body><h1>T</h1><main><details class="doc-section" open><summary><h2>S</h2></summary><div class="section-body">${body}</div></details></main></body></html>`;

  const withBlockMath=validateHtml(base('<p>$$\\text{Taxa} = \\frac{a}{b}$$</p>'));
  assert.equal(withBlockMath.passed,false);
  assert.ok(withBlockMath.errors.some(e=>e.includes('Unrendered LaTeX math')));

  const withInlineNumMath=validateHtml(base('<table><thead><tr><th>Valor</th></tr></thead><tbody><tr><td>$10.000$</td></tr></tbody></table>'));
  assert.equal(withInlineNumMath.passed,false);
  assert.ok(withInlineNumMath.errors.some(e=>e.includes('Unrendered LaTeX math')));

  const withCurrencyAndCode=validateHtml(base('<p>Custos entre $10 e $20 ou R$ 100.</p><pre><code>echo "$HOME" && printf "$$"</code></pre><p>Variável <code>$\\Delta$</code> em trecho técnico.</p>'));
  assert.equal(withCurrencyAndCode.passed,true,withCurrencyAndCode.errors.join('; '));
});

test('generated HTML uses concise search placeholder that fits sidebar input',()=>fixture(async dir=>{
  const out=path.join(dir,'doc.html');
  await build(path.join(root,'examples/minimal/document.json'),out);
  const $=load(await fs.readFile(out,'utf8'));
  const placeholder=$('#search').attr('placeholder')||'';
  assert.ok(placeholder.length>0&&placeholder.length<=20,`Expected concise search placeholder, got "${placeholder}" (${placeholder.length} chars)`);
}));

test('runtime script enables local table filters inside nested <details> dictionaries without touching chart tables',async()=>{
  const js=await fs.readFile(path.join(root,'assets/document.js'),'utf8');
  assert.match(js,/querySelectorAll\(['"]\.section-body \.table-wrap['"]\)/);
  assert.match(js,/wrap\.closest\(['"]\.chart['"]\)/);
});

test('generated HTML includes theme switcher (Default/Atual vs Santander) and supports manifest theme="santander"',()=>fixture(async dir=>{
  await fs.writeFile(path.join(dir,'content.md'),'## S\n\nTexto.\n');
  await fs.writeFile(path.join(dir,'document.json'),JSON.stringify({
    title:'Santander Doc',subtitle:'Tema',version:'1.0',updated:'2026-11-14',theme:'santander',content:'content.md',
    sections:[{id:'sec',title:'S',audience:'all'}]
  }));
  const out=path.join(dir,'santander.html');
  const r=await build(path.join(dir,'document.json'),out);
  assert.equal(r.passed,true);
  const html=await fs.readFile(out,'utf8');
  const $=load(html);
  assert.equal($('html').attr('data-theme'),'santander');
  assert.equal($('[data-theme-select="default"]').length,1);
  assert.equal($('[data-theme-select="santander"].is-active').length,1);
  assert.match(html,/:root\[data-theme="santander"\]/);
  assert.match(html,/--accent:\s*#990000/);
  assert.match(html,/\.sol-zone-warm \.sol-zone-bg/);
  assert.match(html,/\.sol-edge-lineage path/);
}));

test('v1.5.0 build & validate: H3 subnav, back-to-top, H1 guard, authoring warnings, and SVG structural audit',()=>fixture(async dir=>{
  // 1. H1 in Markdown must fail clearly
  await fs.writeFile(path.join(dir,'h1.md'),'## Sec\n\n# Proibido H1\n\nTexto.\n');
  await fs.writeFile(path.join(dir,'h1.json'),JSON.stringify({title:'T',subtitle:'S',version:'1',updated:'2026-11-14',content:'h1.md',sections:[{id:'sec',title:'Sec',audience:'all'}]}));
  await assert.rejects(()=>build(path.join(dir,'h1.json'),path.join(dir,'h1.html')),/H1 heading is reserved/);

  // 2. H3 subnav (excluding .card h3), back-to-top, reserved back-to-top ID, and non-blocking warnings
  await fs.writeFile(path.join(dir,'sub.md'),[
    '## Overview','','<div class="cards"><div class="card"><h3>Card Title</h3><p>X</p></div></div>','',
    '### Architecture Basics','','Texto.','','### Cost Model','','Mais texto.','',
    '## Processing','','### Overview','','Mesmo titulo H3 deve gerar ID unico.','',
    '## Rules','','Regra.','',
    '## Operation','','Operacao.',
  ].join('\n'));
  await fs.writeFile(path.join(dir,'src.txt'),'v1');
  await fs.writeFile(path.join(dir,'sub.json'),JSON.stringify({
    title:'Subnav Test',subtitle:'Test',version:'1.5.0',updated:'2026-11-14',repoRoot:'.',
    content:'sub.md',
    sources:[{id:'s1',path:'src.txt',description:'src'}],
    sections:[
      {id:'overview',title:'Overview',audience:'all',sources:['s1']},
      {id:'processing',title:'Processing',audience:'all'},
      {id:'rules',title:'Rules',audience:'all'},
      {id:'operation',title:'Operation',audience:'all'},
    ]
  }));
  const out=path.join(dir,'sub.html');
  const receipt=await build(path.join(dir,'sub.json'),out);
  assert.equal(receipt.passed,true);
  assert.ok(receipt.warnings.length>=2,'Expected non-blocking warnings for >70% audience:all and omitted section sources');
  const $=load(await fs.readFile(out,'utf8'));
  assert.equal($('#back-to-top').length,1);
  assert.equal($('.sidebar nav .nav-sub[data-parent="overview"] a').length,2);
  assert.equal($('.sidebar nav .nav-sub[data-parent="overview"] a[href="#overview-card-title"]').length,0);
  const subHref=$('.sidebar nav .nav-sub[data-parent="processing"] a').attr('href');
  assert.ok(subHref&&$(subHref).length===1,'H3 subnav link must point to valid DOM anchor');

  // 3. validateHtml catches NaN geometry, negative rect, raw backtick in caption, and ?? in schema SVG
  const badSvg=validateHtml('<!DOCTYPE html><html lang="pt-BR"><head><title>T</title></head><body><h1>T</h1><figure class="diagram"><svg aria-label="X" viewBox="0 0 NaN 100"><rect x="0" y="0" width="-5" height="20"/></svg><figcaption>Com `crase`</figcaption></figure><figure class="diagram"><svg class="schema-svg" aria-label="S" viewBox="0 0 100 100"><text>string??</text></svg><figcaption>Ok</figcaption></figure></body></html>');
  assert.equal(badSvg.passed,false);
  const msg=badSvg.errors.join(' | ');
  assert.match(msg,/viewBox/);
  assert.match(msg,/Invalid SVG geometry attribute/);
  assert.match(msg,/Negative SVG rect/);
  assert.match(msg,/Literal backtick/);
  assert.match(msg,/Double nullable marker/);
}));

test('v1.6.0 summary mode: data-mode, quick-guide badges, companionDoc link, readingMinutes, and length warnings',()=>fixture(async dir=>{
  await fs.writeFile(path.join(dir,'app.py'),'print("ok")\n');
  const sections=Array.from({length:9},(_,i)=>({id:`sec-${i+1}`,title:`Sec ${i+1}`,audience:i%2===0?'business':'technical',sources:['app']}));
  await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({
    title:'Quick Repo',subtitle:'Brief overview',version:'1.0.0',updated:'2026-11-14',
    mode:'summary',companionDoc:{href:'manual-full.html',label:'Manual completo'},
    content:'summary.md',repoRoot:'.',sections,sources:[{id:'app',path:'app.py',description:'App'}]
  }));
  await fs.writeFile(path.join(dir,'summary.md'),sections.map(s=>`## ${s.title}\n\nResumo objetivo.\n`).join('\n'));
  const outHtml=path.join(dir,'summary.html');
  const receipt=await build(path.join(dir,'manifest.json'),outHtml,{force:true});
  assert.equal(receipt.passed,true);
  assert.equal(receipt.mode,'summary');
  assert.ok(receipt.readingMinutes>=1);
  assert.ok(receipt.wordCount>0);
  assert.ok(receipt.warnings.some(w=>w.includes('Summary mode has 9 sections')));
  const html=await fs.readFile(outHtml,'utf8');
  const $=load(html);
  assert.equal($('html').attr('data-mode'),'summary');
  assert.equal($('.badge-mode').text(),'Guia rápido');
  assert.equal($('a.hero-companion').attr('href'),'manual-full.html');
  assert.ok($('.hero-companion').text().includes('Manual completo'));

  // Unsafe companionDoc href must be rejected
  await fs.writeFile(path.join(dir,'bad.md'),'## Sec 1\n\nOk.\n');
  await fs.writeFile(path.join(dir,'bad.json'),JSON.stringify({
    title:'Bad',subtitle:'Bad',version:'1.0.0',updated:'2026-11-14',mode:'summary',
    companionDoc:{href:'javascript:alert(1)',label:'Evil'},content:'bad.md',repoRoot:'.',
    sections:[{id:'sec-1',title:'Sec 1',audience:'all'}]
  }));
  await assert.rejects(()=>build(path.join(dir,'bad.json'),path.join(dir,'bad.html'),{force:true}),/Unsafe companionDoc/);
}));



