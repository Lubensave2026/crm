import {chromium} from 'playwright';
const b=await chromium.launch();const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('https://lubensave2026.github.io/crm/',{waitUntil:'domcontentloaded'});
await p.waitForSelector('#lu, #loginBody b',{timeout:20000});
console.log('LOGIN:',(await p.textContent('#loginBody')).replace(/\s+/g,' ').trim());
console.log('ERRS:',errs.join('|')||'ninguno');await b.close();
