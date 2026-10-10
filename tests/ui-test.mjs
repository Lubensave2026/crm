// Prueba visual y funcional con Chromium headless y un Firebase simulado en memoria.
//   node tests/ui-test.mjs            (capturas en tests/out/)
import {chromium} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.join(dir,'..'),out=path.join(dir,'out');
fs.mkdirSync(out,{recursive:true});
const xlsx=path.join(root,'referencia',fs.readdirSync(path.join(root,'referencia')).find(f=>/Reporte de Actividad.*\.xlsx$/.test(f)));
const user=(id,nombre,rol,pin)=>{const sal='s'+id;return {nombre,rol,sal,pinHash:crypto.createHash('sha256').update(sal+':'+id+':'+pin).digest('hex')}};
const seed={crm_usuarios:{byron:user('byron','Byron','jefe','111111'),ricardo:user('ricardo','Ricardo','asesor','222222'),mario:user('mario','Mario','consulta','333333')},crm_config:{zona10:{min:2,max:5,meta:60000,pct1:1,pct2:2,base:'total',asesor:'Ricardo'}}};
let fallos=0;const ok=(n,v)=>{if(!v)fallos++;console.log((v?'OK  ':'FALLA')+' '+n)};
const mods={app:'fake/app.js',auth:'fake/auth.js',firestore:'fake/firestore.js'};
const browser=await chromium.launch();
async function abrir(vp){
  const ctx=await browser.newContext({viewport:vp,timezoneId:'America/Guatemala'});const page=await ctx.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/fonts|favicon|ERR_/i.test(m.text()))errs.push(m.text())});
  await page.route(/gstatic\.com\/firebasejs\/.*\/firebase-(app|auth|firestore)\.js/,r=>{const k=r.request().url().match(/firebase-(\w+)\.js/)[1];r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(dir,mods[k]),'utf8')})});
  await page.addInitScript(s=>{globalThis.__DB=globalThis.__DB||JSON.parse(s)},JSON.stringify(seed));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForSelector('#lu');
  return {ctx,page,errs};
}
async function login(page,nombre,pin){await page.click(`#lu button:has-text("${nombre}")`);await page.fill('#lpin',pin);await page.click('#lgo');await page.waitForSelector('#login',{state:'hidden'})}
const tabs=['hoy','cartera','caso','importar','semana'];
const sinEsp=async(page,sel)=>(await page.textContent(sel)).replace(/\s/g,'');

for(const [tag,vp] of [['desktop',{width:1280,height:900}],['movil',{width:400,height:850}]]){
  const {ctx,page,errs}=await abrir(vp);
  await page.screenshot({path:path.join(out,`00-login-${tag}.png`)});
  await login(page,'Ricardo','222222');
  await page.click('nav button[data-t="importar"]');
  await page.setInputFiles('#file',xlsx);
  await page.waitForSelector('#kCart',{timeout:60000});
  await page.waitForTimeout(600);
  if(tag==='desktop'){
    ok('importación: cartera Q1,068,512',await sinEsp(page,'#kCart')==='Q1,068,512');
    ok('importación: 102 casos nuevos',/102/.test(await page.textContent('#impRes')));
    ok('importación: 54 avisos',/>54</.test(await page.innerHTML('#impRes')));
    ok('agenda de hoy creada (2 a 5 casos)',await page.evaluate(()=>{const a=Object.values(__DB.crm_agenda||{})[0];return !!a&&a.ots.length>=2&&a.ots.length<=5}));
    await page.setInputFiles('#file',xlsx);await page.waitForSelector('#kCart');await page.waitForTimeout(1200);
    ok('reimportar: sigue en 102 casos',(await page.evaluate(()=>Object.keys(__DB.crm_casos).length))===102);
    ok('reimportar: cartera igual',await sinEsp(page,'#kCart')==='Q1,068,512');
    ok('reimportar: no duplica la bitácora',await page.evaluate(()=>Object.values(__DB.crm_casos).every(c=>c.bitacora.length===1)));
    await page.click('nav button[data-t="cartera"]');await page.fill('#fBus','5381');await page.click('tr[data-ver="5381"]');
    await page.click('button[data-a="autorizo"]');await page.selectOption('#aT','parcial');await page.fill('#aM','22699');await page.fill('#aMO','5000');await page.click('#dOk');await page.waitForTimeout(400);
    await page.click('nav button[data-t="cartera"]');await page.fill('#fBus','');await page.waitForTimeout(200);
    ok('parcial OT 5381: cartera Q1,045,813',await sinEsp(page,'#kDorm')==='Q1,045,813');
    await page.click('nav button[data-t="semana"]');await page.waitForTimeout(200);
    ok('semana: recuperado Q22,699',await sinEsp(page,'#kSem')==='Q22,699');
    ok('bitácora guarda usuario',await page.evaluate(()=>__DB.crm_casos['5381'].bitacora.some(b=>b.usuario==='Ricardo'&&/Autorizado/.test(b.resultado))));
    ok('bitácora conserva la entrada de importación',await page.evaluate(()=>__DB.crm_casos['5381'].bitacora.length===2));
    ok('asesor no ve Ajustes',!(await page.$('#cSave')));
    ok('sin datos de casos en localStorage',await page.evaluate(()=>!Object.keys(localStorage).some(k=>/casos|cartera|agenda/i.test(k))));
    // Protección: monto menor al pendiente con Tipo "Total" (por defecto) se registra como Parcial
    await page.click('nav button[data-t="cartera"]');await page.fill('#fBus','5399');await page.click('tr[data-ver="5399"]');
    await page.click('button[data-a="autorizo"]');await page.fill('#aM','5000');
    ok('Total→Parcial automático al bajar el monto',(await page.inputValue('#aT'))==='parcial');
    await page.selectOption('#aT','total');await page.fill('#aM','5000');await page.dispatchEvent('#aT','change');await page.fill('#aM','5000');await page.click('#dOk');await page.waitForTimeout(400);
    ok('guardó como parcial y el caso sigue abierto',await page.evaluate(()=>{const c=__DB.crm_casos['5399'];return c.estado!=='Recuperado'&&c.recuperos.at(-1).tipo==='parcial'&&Object.values(c.partidas).every(p=>!p.recuperada)}));
    // Respaldo en Excel
    await page.click('nav button[data-t="semana"]');await page.waitForTimeout(200);
    const [dl]=await Promise.all([page.waitForEvent('download'),page.click('#bkp')]);
    const fx=path.join(out,'respaldo.xlsx');await dl.saveAs(fx);await page.waitForTimeout(300);
    const XL=(await import('xlsx')).default;const wbk=XL.read(fs.readFileSync(fx),{type:'buffer'});
    ok('respaldo: hojas',JSON.stringify(wbk.SheetNames)===JSON.stringify(['Resumen','Cartera','Partidas','Bitácora','Recuperos']));
    ok('respaldo: 102 casos en Cartera',XL.utils.sheet_to_json(wbk.Sheets.Cartera).length===102);
    ok('respaldo: nombre con fecha',/^CRM_LNS_Respaldo_\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()));
    ok('respaldo: se anota en crm_config',await page.evaluate(()=>__DB.crm_config.zona10.ultimoRespaldo?.por==='Ricardo'));
    ok('respaldo: la pantalla muestra el último respaldo',/Último respaldo/.test(await page.textContent('#bkInfo')));
    // Hoy: registrar "Sin respuesta" en el primer caso
    await page.click('nav button[data-t="hoy"]');await page.waitForTimeout(200);
    const antesH=await page.evaluate(()=>Object.values(__DB.crm_casos).filter(c=>c.resHoy).length);
    await page.click('button[data-a="sinresp"] >> nth=0');await page.waitForTimeout(400);
    ok('Hoy: sin respuesta registra el caso y reprograma 3 días',await page.evaluate(a=>{const c=Object.values(__DB.crm_casos).filter(c=>c.resHoy);return c.length===a+1&&c.some(x=>x.estado==='Sin respuesta'&&x.proximo)},antesH));
  }
  await page.click('nav button[data-t="cartera"]');await page.waitForTimeout(150);
  await page.click('tr.click >> nth=0');await page.waitForTimeout(150);
  for(const t of tabs){
    await page.click(`nav button[data-t="${t}"]`);await page.waitForTimeout(250);
    await page.screenshot({path:path.join(out,`${tabs.indexOf(t)+1}-${t}-${tag}.png`),fullPage:true});
    if(tag==='movil'){const d=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);ok(`móvil sin scroll horizontal en ${t}`,d<=1)}
  }
  ok(`sin errores de consola (${tag}) ${errs.join(' | ').slice(0,200)}`,errs.length===0);
  await ctx.close();
}
{
  const a=await abrir({width:1280,height:900});await login(a.page,'Mario','333333');
  await a.page.click('nav button[data-t="semana"]');ok('consulta: sin botón de respaldo',!(await a.page.$('#bkp')));
  ok('consulta: sin pestaña Importar',await a.page.isHidden('nav button[data-t="importar"]'));
  await a.page.click('nav button[data-t="semana"]');ok('consulta: sin Ajustes',!(await a.page.$('#cSave')));
  await a.ctx.close();
  const b=await abrir({width:1280,height:900});await login(b.page,'Byron','111111');await b.page.click('nav button[data-t="semana"]');
  ok('jefe: ve Ajustes',!!(await b.page.$('#cSave')));
  await b.page.click('nav button[data-t="importar"]');await b.page.setInputFiles('#file',xlsx);await b.page.waitForSelector('#kCart',{timeout:60000});await b.page.waitForTimeout(600);
  await b.page.click('nav button[data-t="hoy"]');await b.page.waitForTimeout(300);ok('jefe: aviso de respaldo en Hoy cuando no hay',/respaldo/i.test(await b.page.textContent('#hoy')));
  await b.page.click('nav button[data-t="semana"]');
  await b.page.screenshot({path:path.join(out,'6-semana-jefe.png'),fullPage:true});await b.ctx.close();
  const m=await abrir({width:1280,height:900});await m.page.click('#lu button:has-text("Ricardo")');await m.page.fill('#lpin','000000');await m.page.click('#lgo');
  ok('PIN incorrecto rechazado',/incorrecto/i.test(await m.page.textContent('#lerr')));await m.ctx.close();
}
await browser.close();
console.log(fallos?`\n${fallos} FALLAS`:'\nTodo OK');process.exit(fallos?1:0);
