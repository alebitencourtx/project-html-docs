import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {Marked} from 'marked';
import Ajv from 'ajv';
import sanitizeHtml from 'sanitize-html';
import {load} from 'cheerio';
import {renderMermaidSVG} from 'beautiful-mermaid';
import {validateHtml} from './validate.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=v=>createHash('sha256').update(v).digest('hex');
const textTags=[...sanitizeHtml.defaults.allowedTags,'details','summary','div','span','figure','figcaption'];
const clean=v=>sanitizeHtml(v,{allowedTags:textTags,allowedAttributes:{...sanitizeHtml.defaults.allowedAttributes,'*':['class'],a:['href','title'],details:['open']},allowedSchemes:['https','http','mailto'],allowProtocolRelative:false});

export function barChart(spec,locale='pt-BR'){
  if(spec.type!=='bar'||!spec.title||!spec.unit||!spec.source||!Array.isArray(spec.data)||!spec.data.length||spec.data.length>40)throw Error('chart requires type=bar, title, unit, source, and 1–40 data items');
  const seen=new Set();for(const d of spec.data){if(typeof d.label!=='string'||!d.label.trim()||d.label.length>45||!Number.isFinite(d.value)||d.value<0||seen.has(d.label))throw Error('chart labels must be unique (max 45 chars); values must be finite and nonnegative');seen.add(d.label);}
  const max=Math.max(1,...spec.data.map(d=>d.value)),w=880,row=42,h=spec.data.length*row+45,left=220,plot=540;
  const fmt=new Intl.NumberFormat(locale,{maximumFractionDigits:2});
  const bars=spec.data.map((d,i)=>{const y=i*row+16;return `<text x="${left-14}" y="${y+15}" text-anchor="end" fill="#314c5e">${esc(d.label)}</text><rect x="${left}" y="${y}" width="${plot}" height="23" rx="4" fill="#e8eff3"/><rect x="${left}" y="${y}" width="${d.value/max*plot}" height="23" rx="4" fill="#087f8c"/><text x="${left+plot+14}" y="${y+16}" fill="#172b3c" font-weight="600">${esc(fmt.format(d.value))}</text>`;}).join('');
  const table=`<table><thead><tr><th>${locale==='pt-BR'?'Categoria':'Category'}</th><th>${esc(spec.unit)}</th></tr></thead><tbody>${spec.data.map(d=>`<tr><td>${esc(d.label)}</td><td>${esc(fmt.format(d.value))}</td></tr>`).join('')}</tbody></table>`;
  return `<figure class="chart"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(spec.title)}" style="font-family:Segoe UI,Arial,sans-serif;font-size:15px">${bars}<text x="${left}" y="${h-3}" fill="#526778" font-size="12">0 · ${esc(spec.unit)} · ${locale==='pt-BR'?'escala linear':'linear scale'}</text></svg><figcaption><strong>${esc(spec.title)}</strong> · ${esc(spec.source)}${spec.asOf?' · '+esc(spec.asOf):''}</figcaption><details><summary>${locale==='pt-BR'?'Dados do gráfico':'Chart data'}</summary><div class="table-wrap">${table}</div></details></figure>`;
}

export async function build(manifestFile,output,{force=false}={}){
  const manifestPath=path.resolve(manifestFile),base=path.dirname(manifestPath);const spec=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  const schema=JSON.parse(await fs.readFile(path.join(ROOT,'schemas/document.schema.json'),'utf8'));
  const validate=new Ajv({allErrors:true}).compile(schema);if(!validate(spec))throw Error(JSON.stringify(validate.errors));
  if(!output)throw Error('Choose an output with --out; no file is overwritten unless --force is explicit');
  output=path.resolve(output);try{await fs.access(output);if(!force)throw Error(`Output already exists: ${output}; choose a new name or --force`);}catch(e){if(e.code!=='ENOENT')throw e;}
  const input=path.resolve(base,spec.content);if(output===input||output===manifestPath)throw Error('Output cannot overwrite an input');
  const md=await fs.readFile(input,'utf8');const en=spec.language==='en',locale=en?'en':'pt-BR';
  const words=en?{all:'Everyone',business:'Business',technical:'Technical',operations:'Operations',search:'Search documentation',expand:'Expand all',collapse:'Collapse all',print:'Print / PDF',none:'No sections found.',offline:'Single HTML · offline reading',sources:'Sources',updated:'Updated',code:'Code',diagram:'Expand',close:'Close',hint:'Choose a section or read from top to bottom.',data:'Data as of',reference:'Document references'}:{all:'Para todos',business:'Funcional',technical:'Técnico',operations:'Operação',search:'Pesquisar documentação',expand:'Expandir tudo',collapse:'Recolher tudo',print:'Imprimir / PDF',none:'Nenhuma seção encontrada.',offline:'HTML único · leitura offline',sources:'Referências',updated:'Atualizado',code:'Código',diagram:'Ampliar',close:'Fechar',hint:'Navegue por assunto ou leia na sequência.',data:'Dados observados em',reference:'Referências do documento'};
  const sourceMap=new Map(),evidence=[];
  for(const source of spec.sources||[]){if(sourceMap.has(source.id))throw Error(`Duplicate source: ${source.id}`);if(!spec.repoRoot)throw Error('repoRoot is required for local sources');const repo=path.resolve(base,spec.repoRoot);const p=path.resolve(repo,source.path);const rel=path.relative(repo,p);if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Source outside repository');const raw=await fs.readFile(p);const item={...source,sha256:hash(raw)};sourceMap.set(source.id,item);evidence.push(item);}
  const ids=new Set();for(const section of spec.sections){if(ids.has(section.id))throw Error(`Duplicate section: ${section.id}`);ids.add(section.id);for(const s of section.sources||[])if(!sourceMap.has(s))throw Error(`Unknown source: ${s}`);}
  const mdParser=new Marked({gfm:true});const tokens=mdParser.lexer(md);const groups=[];let current;
  for(const token of tokens){if(token.type==='heading'&&token.depth===2){current={title:token.text,tokens:[]};groups.push(current);}else if(current)current.tokens.push(token);else if(token.type!=='space')throw Error('Start content with a level-two heading listed in document.json');}
  if(groups.length!==spec.sections.length||groups.some((g,i)=>g.title!==spec.sections[i].title))throw Error('Markdown H2 headings must match sections[].title in order');
  let diagramIndex=0;const generated=new Map();
  mdParser.use({renderer:{html({text}){return text;},code({text,lang}){
    const type=(lang||'').split(' ')[0];let html;
    if(type==='mermaid'){
      const title=(lang||'').slice(7).trim();if(!title)throw Error('Give each mermaid fence a descriptive title after mermaid');
      const raw=renderMermaidSVG(text,{bg:'#f8fbfc',fg:'#172b3c',accent:'#087f8c',line:'#7992a2',surface:'#ffffff',border:'#b8cbd5',font:'Segoe UI',padding:22,nodeSpacing:28,layerSpacing:38});
      const $=load(raw,{xml:true});$('style').each((_,e)=>$(e).text($(e).text().replace(/@import\s+url\([^)]*\)\s*;/g,'')));const svg=$('svg');const prefix=`diagram-${++diagramIndex}-`;const replaces=new Map();$('[id]').each((_,e)=>{const old=$(e).attr('id');replaces.set(old,prefix+old);$(e).attr('id',prefix+old);});
      $('*').each((_,e)=>{for(const [a,v] of Object.entries(e.attribs||{})){let next=v;for(const [old,id]of replaces){next=next.replaceAll(`url(#${old})`,`url(#${id})`);if(next===`#${old}`)next=`#${id}`;}if(next!==v)$(e).attr(a,next);}});
      const width=parseFloat(svg.attr('width'))||Number(svg.attr('viewBox')?.split(/\s+/)[2])||800;
      const displayWidth=width*(/^\s*erDiagram/m.test(text)?1.35:1.15);
      svg.attr({'role':'img','aria-label':title,'data-natural-width':String(displayWidth),'style':`${svg.attr('style')||''};width:${displayWidth}px;min-width:${Math.round(displayWidth*.9)}px;max-width:100%`});
      html=`<figure class="diagram"><div class="figure-tools"><span>SVG · ${en?'vector diagram':'diagrama vetorial'}</span><button type="button" data-expand-diagram>${words.diagram}</button></div><div class="diagram-scroll">${$.xml()}</div><figcaption>${esc(title)}</figcaption></figure>`;
    }else if(type==='chart'){html=barChart(JSON.parse(text),locale);}else{return `<pre><code${type?` class="language-${esc(type)}"`:''}>${esc(text)}</code></pre>`;}
    const key=`GENERATEDVISUAL${generated.size}END`;generated.set(key,html);return `<div>${key}</div>`;
  }}});
  const body=groups.map((g,i)=>{const section=spec.sections[i];let content=mdParser.parser(g.tokens);content=clean(content).replaceAll('<table>','<div class="table-wrap"><table>').replaceAll('</table>','</table></div>');for(const[key,value]of generated)content=content.replace(`<div>${key}</div>`,value);const refs=(section.sources||[]).map(id=>`<a href="#ref-${id}">${esc(sourceMap.get(id).path)}</a>`).join(' ');return `<details class="doc-section" id="${section.id}" open><summary class="section-heading"><span class="number">${String(i+1).padStart(2,'0')}</span><h2>${esc(section.title)}</h2><span class="audience ${section.audience}">${words[section.audience]}</span></summary><div class="section-body">${content}${refs?`<div class="section-sources">${words.sources}: ${refs}</div>`:''}</div></details>`;}).join('\n');
  const nav=spec.sections.map((s,i)=>`<a href="#${s.id}"><span>${String(i+1).padStart(2,'0')}</span>${esc(s.title)}</a>`).join('');
  const refs=evidence.length?`<details class="doc-section" id="document-references"><summary class="section-heading"><h2>${words.reference}</h2></summary><div class="section-body"><p>${en?'Local files used to describe this revision.':'Arquivos locais usados para descrever esta revisão. As referências são para aprofundamento; o conteúdo necessário à leitura está incorporado.'}</p><div class="table-wrap"><table><thead><tr><th>${en?'File':'Arquivo'}</th><th>${en?'Purpose':'Conteúdo'}</th></tr></thead><tbody>${evidence.map(s=>`<tr id="ref-${s.id}"><td class="source-path">${esc(s.path)}</td><td>${esc(s.description)}</td></tr>`).join('')}</tbody></table></div><p class="revision">${words.code}: ${esc(spec.revision||'—')}</p></div></details>`:'';
  const cards=(spec.cards||[]).map(c=>`<article class="metric"><span class="label">${esc(c.label)}</span><strong>${esc(c.value)}</strong><p>${esc(c.description)}</p></article>`).join('');
  const css=await fs.readFile(path.join(ROOT,'assets/document.css'),'utf8');const js=await fs.readFile(path.join(ROOT,'assets/document.js'),'utf8');
  const html=`<!DOCTYPE html>\n<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(spec.subtitle)}"><meta name="generator" content="project-html-docs 1.0.0"><title>${esc(spec.title)} · ${esc(spec.version)}</title><style>${css}</style></head><body><a class="skip" href="#main">${en?'Skip to content':'Ir para o conteúdo'}</a><aside class="sidebar"><p class="brand">${en?'Project documentation':'Documentação de projeto'}</p><strong>${esc(spec.title)}</strong><label for="search">${words.search}</label><input id="search" type="search" autocomplete="off" placeholder="${en?'Rules, tables, execution…':'Regras, tabelas, execução…'}"><div id="search-count" class="search-count" role="status" aria-live="polite"></div><nav aria-label="${en?'Contents':'Conteúdo'}">${nav}${refs?`<a href="#document-references">${words.sources}</a>`:''}</nav><small>${words.offline}<br>${esc(spec.version)} · ${esc(spec.updated)}</small></aside><main id="main"><header class="hero"><p class="eyebrow">${esc(spec.eyebrow||'Documentação funcional e técnica')}</p><h1>${esc(spec.title)}</h1><p class="subtitle">${esc(spec.subtitle)}</p><div class="badges"><span>${esc(spec.version)}</span><span>${words.updated}: ${esc(spec.updated)}</span><span>${words.offline}</span>${spec.dataAsOf?`<span>${words.data}: ${esc(spec.dataAsOf)}</span>`:''}</div></header><div class="content">${cards?`<div class="hero-cards">${cards}</div>`:''}<div class="toolbar"><span class="hint">${words.hint}</span><button id="expand" type="button">${words.expand}</button><button id="collapse" type="button">${words.collapse}</button><button id="print" type="button">${words.print}</button></div><p id="no-results" hidden>${words.none}</p>${body}${refs}<footer>${esc(spec.title)} · ${esc(spec.version)} · ${words.offline}</footer></div></main><dialog id="diagram-dialog" aria-labelledby="dialog-title"><div class="dialog-head"><strong id="dialog-title"></strong><button id="dialog-close" type="button">${words.close}</button></div><div id="dialog-canvas" class="dialog-canvas"></div></dialog><script>${js}</script></body></html>`;
  const receipt={...validateHtml(html),version:'1.0.0',document:spec.title,revision:spec.revision||null,inputSha256:hash(md),htmlSha256:hash(html),sources:evidence};if(!receipt.passed)throw Error(JSON.stringify(receipt.errors));
  await fs.mkdir(path.dirname(output),{recursive:true});const temporary=output+'.tmp';await fs.writeFile(temporary,html);await fs.rename(temporary,output);await fs.writeFile(output.replace(/\.html$/i,'')+'.validation.json',JSON.stringify(receipt,null,2)+'\n');return receipt;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const args=process.argv.slice(2);const i=args.indexOf('--out');const receipt=await build(args[0],i>=0?args[i+1]:null,{force:args.includes('--force')});console.log(JSON.stringify({passed:receipt.passed,sections:receipt.sections,diagrams:receipt.diagrams,charts:receipt.charts,bytes:receipt.bytes,browserReviewed:false},null,2));}catch(e){console.error(e.stack||e.message);process.exitCode=1;}}
