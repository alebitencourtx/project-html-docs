import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {load} from 'cheerio';

export function validateHtml(html) {
  const $=load(html); const errors=[]; const ids=new Set();
  $('[id]').each((_,e)=>{const id=$(e).attr('id');if(ids.has(id))errors.push(`Duplicate id: ${id}`);ids.add(id);});
  $('a[href^="#"]').each((_,e)=>{const target=$(e).attr('href').slice(1);if(target&&!ids.has(target))errors.push(`Broken anchor: ${target}`);});
  $('script[src],link[href],iframe,object,embed,base').each((_,e)=>errors.push(`External or unsupported asset: ${e.tagName}`));
  $('[src],[srcset],[poster]').each((_,e)=>{for(const attr of ['src','srcset','poster']){const value=$(e).attr(attr);if(value&&!value.startsWith('data:'))errors.push(`Non-embedded ${attr}: ${value}`);}});
  $('svg image,svg use').each((_,e)=>{const href=$(e).attr('href')||$(e).attr('xlink:href');if(href&&!href.startsWith('#')&&!href.startsWith('data:'))errors.push('External SVG reference');});
  const css=$('style').text();if(/@import\b/i.test(css)||/url\(\s*['"]?(?!data:|#)[^)]/i.test(css))errors.push('External CSS resource');
  $('[style]').each((_,e)=>{const style=$(e).attr('style')||'';if(/url\(\s*['"]?(?!data:|#)[^)]/i.test(style))errors.push('External inline style resource');});
  if(/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|import\s*\()/i.test($('script').text()))errors.push('Runtime network loader');
  if(!html.startsWith('<!DOCTYPE html>'))errors.push('Missing HTML doctype');
  if(!$('title').text().trim()||!$('html').attr('lang'))errors.push('Missing title/language');
  if($('h1').length!==1)errors.push('Expected one main title');
  $('figure').each((_,e)=>{if(!$(e).find('figcaption').length)errors.push('Figure missing figcaption');});
  $('details').each((_,e)=>{if($(e).children('summary').length!==1)errors.push('Details missing a single summary');});
  $('table').each((_,e)=>{if(!$(e).find('thead').length||!$(e).find('th').length)errors.push('Table missing header cells');});
  $('a[href]').each((_,e)=>{if(/^javascript:/i.test($(e).attr('href')))errors.push('Unsafe link');if(!$(e).text().trim()&&!$(e).find('img').length)errors.push('Link without text');});
  let sawH2=false,sawH3=false;
  $('h1,h2,h3,h4').each((_,e)=>{
    const tag=e.tagName.toLowerCase();const text=$(e).text().trim();
    if(tag==='h2'){sawH2=true;sawH3=false;}
    if(tag==='h3'){if(!sawH2)errors.push(`H3 without H2: ${text}`);sawH3=true;}
    if(tag==='h4'&&!sawH3)errors.push(`H4 without H3: ${text}`);
  });
  $('figure svg').each((_,e)=>{if(!$(e).attr('aria-label')&&!$(e).attr('aria-labelledby'))errors.push('SVG missing accessible name');});
  const proseClone=$('main').clone();proseClone.find('pre,code,svg,script,style').remove();
  const proseText=proseClone.text();
  if(/\$\$[\s\S]+?\$\$|\\(?:text|frac|sum|Delta|times|le|ge|approx|cdot)\s*(?:\{|\\|\b)|\$[^$\n]*\\(?:text|frac|sum|Delta|times|le|ge)|\$[0-9][0-9.,]*%?\$/m.test(proseText)){
    errors.push('Unrendered LaTeX math in prose/tables (use Unicode/HTML instead of $...$)');
  }
  const totalSections=$('.doc-section').length;const referenceBlocks=$('#document-references').length;const sections=totalSections-referenceBlocks;
  return {passed:errors.length===0,errors,sections,contentSections:sections,referenceBlocks,diagrams:$('figure.diagram').length,charts:$('figure.chart').length,bytes:Buffer.byteLength(html),browserReviewed:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const result=validateHtml(await fs.readFile(process.argv[2],'utf8'));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}
}
