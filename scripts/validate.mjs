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
  if(/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|import\s*\()/i.test($('script').text()))errors.push('Runtime network loader');
  if(!html.startsWith('<!DOCTYPE html>'))errors.push('Missing HTML doctype');
  if(!$('title').text().trim()||!$('html').attr('lang'))errors.push('Missing title/language');
  if($('h1').length!==1)errors.push('Expected one main title');
  $('figure svg').each((_,e)=>{if(!$(e).attr('aria-label')&&!$(e).attr('aria-labelledby'))errors.push('SVG missing accessible name');});
  $('a[href]').each((_,e)=>{if(/^javascript:/i.test($(e).attr('href')))errors.push('Unsafe link');});
  return {passed:errors.length===0,errors,sections:$('.doc-section').length,diagrams:$('figure.diagram').length,charts:$('figure.chart').length,bytes:Buffer.byteLength(html),browserReviewed:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const result=validateHtml(await fs.readFile(process.argv[2],'utf8'));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}
}
