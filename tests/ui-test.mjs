// Prueba visual y funcional con Chromium headless y un Firebase simulado en memoria.
//   node tests/ui-test.mjs            (capturas en tests/out/)
import {chromium} from 'playwright';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.join(dir,'..'),out=path.join(dir,'out');
fs.mkdirSync(out,{recursive:true});
const xlsx=path.join(root,'referencia',fs.readdirSync(path.join(root,'referencia')).find(f=>/Reporte de Actividad.*\.xlsx$/.test(f)));
const formas=path.join(root,'referencia',fs.readdirSync(path.join(root,'referencia')).find(f=>/Formas.*xlsx$/.test(f)&&!f.startsWith('~')));
const user=(id,nombre,rol,pin)=>{const sal='s'+id;return {nombre,rol,sal,pinHash:crypto.createHash('sha256').update(sal+':'+id+':'+pin).digest('hex')}};
const seed={crm_usuarios:{byron:user('byron','Byron','jefe','111111'),ricardo:user('ricardo','Ricardo','asesor','222222'),mario:user('mario','Mario','consulta','333333')},crm_config:{zona10:{min:2,max:5,meta:60000,pct1:1,pct2:2,base:'total',asesor:'Ricardo'}}};
let fallos=0;const ok=(n,v)=>{if(!v)fallos++;console.log((v?'OK  ':'FALLA')+' '+n)};
const mods={app:'fake/app.js',auth:'fake/auth.js',firestore:'fake/firestore.js'};
const browser=await chromium.launch();
async function abrir(vp){
  const ctx=await browser.newContext({viewport:vp,timezoneId:'America/Guatemala'});const page=await ctx.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/fonts|favicon|ERR_/i.test(m.text()))errs.push(m.text())});
  await page.route(/gstatic\.com\/firebasejs\/.*\/firebase-(app|auth|firestore)\.js/,r=>{const k=r.request().url().match(/firebase-(\w+)\.js/)[1];r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(dir,mods[k]),'utf8')})});
  await page.addInitScript(s=>{const p=sessionStorage.getItem('__fakeDB');globalThis.__DB=JSON.parse(p||s)},JSON.stringify(seed));
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
  if(tag==='desktop'){
    ok('aviso de novedades visible al entrar',await page.isVisible('#nov')&&/Instala la herramienta como aplicación/.test(await page.textContent('#nov')));
    ok('punto de novedad en la pestaña Manual',await page.isVisible('#manDot'));
    await page.click('#nov [data-go="manual"]');await page.waitForTimeout(200);
    ok('manual: muestra Novedades marcadas como nuevas',/NUEVO/.test(await page.textContent('#manual')));
    ok('manual: asesor ve la rutina diaria y la carga',/Tu rutina diaria/.test(await page.textContent('#manual'))&&/Formas de Inspección/.test(await page.textContent('#manual')));
    ok('manual: asesor no ve la sección del jefe',!/Solo jefe de taller/.test(await page.textContent('#manual')));
    ok('al abrir el manual desaparece el aviso y el punto',!(await page.isVisible('#nov'))&&!(await page.isVisible('#manDot')));
    await page.screenshot({path:path.join(out,'7-manual-desktop.png'),fullPage:true});
    await page.click('button[data-sec="m-carga"]');await page.waitForTimeout(500);
  }
  await page.click('nav button[data-t="importar"]');
  await page.setInputFiles('#file',[xlsx,formas]);
  await page.waitForSelector('#kCart',{timeout:60000});await page.waitForSelector('#impEnl',{timeout:60000});
  await page.waitForTimeout(600);
  if(tag==='desktop'){
    ok('importación: cartera Q1,068,512',await sinEsp(page,'#kCart')==='Q1,068,512');
    ok('importación: 102 casos nuevos',/102/.test(await page.textContent('#impRes')));
    ok('importación: 54 avisos',/>54</.test(await page.innerHTML('#impRes')));
    ok('agenda de hoy creada (2 a 5 casos)',await page.evaluate(()=>{const a=Object.values(__DB.crm_agenda||{})[0];return !!a&&a.ots.length>=2&&a.ots.length<=5}));
    ok('enlaces: 220 guardados en un solo documento',await page.evaluate(()=>Object.keys(__DB.crm_enlaces.zona10.urls).length===220));
    ok('enlaces: 100 de 102 casos con enlace',/100 de 102 tienen enlace/.test(await page.textContent('#impEnl')));
    ok('enlaces: avisa de los casos sin enlace',/2 casos abiertos sin enlace/.test(await page.textContent('#impRes')));
    await page.setInputFiles('#file',[formas,xlsx]);await page.waitForSelector('#kCart');await page.waitForSelector('#impEnl');await page.waitForTimeout(1200);
    ok('reimportar enlaces: 0 nuevos y 0 actualizados',await page.evaluate(()=>{const n=[...document.querySelectorAll('#impEnl .num')].map(x=>x.textContent);return n[1]==='0'&&n[2]==='0'}));
    ok('importar: archivo desconocido se rechaza',await (async()=>{const X=(await import('xlsx')).default;const wb=X.utils.book_new();X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['a','b'],[1,2]]),'h');
      await page.setInputFiles('#file',{name:'raro.xlsx',mimeType:'application/octet-stream',buffer:X.write(wb,{type:'buffer',bookType:'xlsx'})});await page.waitForTimeout(800);return /No reconozco/.test(await page.textContent('#impRes'))})());
    await page.setInputFiles('#file',xlsx);await page.waitForSelector('#kCart');await page.waitForTimeout(1200);
    ok('reimportar: sigue en 102 casos',(await page.evaluate(()=>Object.keys(__DB.crm_casos).length))===102);
    ok('reimportar: cartera igual',await sinEsp(page,'#kCart')==='Q1,068,512');
    ok('reimportar: no duplica la bitácora',await page.evaluate(()=>Object.values(__DB.crm_casos).every(c=>c.bitacora.length===1)));
    await page.click('nav button[data-t="cartera"]');await page.fill('#fBus','5381');await page.click('tr[data-ver="5381"]');
    await page.click('#caso button[data-a="autorizo"]');await page.selectOption('#aT','parcial');await page.fill('#aM','22699');await page.fill('#aMO','5000');await page.click('#dOk');await page.waitForTimeout(400);
    await page.click('nav button[data-t="cartera"]');await page.fill('#fBus','');await page.waitForTimeout(200);
    ok('parcial OT 5381: cartera Q1,045,813',await sinEsp(page,'#kDorm')==='Q1,045,813');
    await page.click('nav button[data-t="semana"]');await page.waitForTimeout(200);
    ok('semana: recuperado Q22,699',await sinEsp(page,'#kSem')==='Q22,699');
    ok('bitácora guarda usuario',await page.evaluate(()=>__DB.crm_casos['5381'].bitacora.some(b=>b.usuario==='Ricardo'&&/Autorizado/.test(b.resultado))));
    ok('bitácora conserva la entrada de importación',await page.evaluate(()=>__DB.crm_casos['5381'].bitacora.length===2));
    ok('asesor no ve Ajustes',!(await page.$('#cSave')));
    await page.click('nav button[data-t="cartera"]');await page.fill('#fBus','5381');await page.click('tr[data-ver="5381"]');ok('Caso: sin enlace a TallerFLOW',!/TallerFLOW/i.test(await page.textContent('#caso')));ok('Caso: conserva Marcar en taller',!!(await page.$('#caso button[data-a="taller"]')));await page.click('nav button[data-t="semana"]');
    ok('sin datos de casos en localStorage',await page.evaluate(()=>!Object.keys(localStorage).some(k=>/casos|cartera|agenda/i.test(k))));
    // Enlace de inspección en el caso, en la tarjeta de Hoy y en el mensaje
    await page.click('nav button[data-t="cartera"]');await page.fill('#fBus','5381');await page.click('tr[data-ver="5381"]');
    const lnk=await page.$('#caso a:has-text("Ver reporte con fotos y videos")');
    ok('Caso: botón Ver reporte con enlace vehi.mobi',!!lnk&&/^https:\/\/vehi\.mobi\//.test(await lnk.getAttribute('href')));
    ok('Caso: el mensaje de WhatsApp incluye el enlace',/vehi\.mobi\/\w+/.test(await page.textContent('#caso .msg')));
    ok('Caso: Abrir WhatsApp lleva el enlace codificado',decodeURIComponent(await page.getAttribute('#caso a:has-text("Abrir WhatsApp")','href')).includes('https://vehi.mobi/'));
    await page.click('nav button[data-t="cartera"]');await page.fill('#fBus','5211');await page.click('tr[data-ver="5211"]');
    ok('Caso sin enlace: avisa y no muestra el botón',/no tiene enlace de inspección/.test(await page.textContent('#caso'))&&!(await page.$('#caso a:has-text("Ver reporte")')));
    await page.click('nav button[data-t="hoy"]');await page.waitForTimeout(200);
    ok('Hoy: tarjetas con botón Ver reporte',(await page.$$('#hoy a:has-text("Ver reporte")')).length>=1);
    // Protección: monto menor al pendiente con Tipo "Total" (por defecto) se registra como Parcial
    await page.click('nav button[data-t="cartera"]');await page.fill('#fBus','5399');await page.click('tr[data-ver="5399"]');
    await page.click('#caso button[data-a="autorizo"]');await page.fill('#aM','5000');
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
  await a.page.click('nav button[data-t="manual"]');await a.page.waitForTimeout(200);
  ok('manual: consulta ve su nota y no ve la rutina de asesor',/Tu usuario es de consulta/.test(await a.page.textContent('#manual'))&&!/Tu rutina diaria/.test(await a.page.textContent('#manual')));
  ok('consulta: sin pestaña Importar',await a.page.isHidden('nav button[data-t="importar"]'));
  await a.page.click('nav button[data-t="semana"]');ok('consulta: sin Ajustes',!(await a.page.$('#cSave')));
  await a.ctx.close();
  // Cambiar PIN propio (Ricardo)
  const r=await abrir({width:1280,height:900});await login(r.page,'Ricardo','222222');
  await r.page.click('#novX');ok('Entendido oculta el aviso',!(await r.page.isVisible('#nov')));
  await r.page.click('#cpin');await r.page.fill('#pA','999999');await r.page.fill('#pN1','654321');await r.page.fill('#pN2','654321');await r.page.click('#dOk');await r.page.waitForTimeout(300);
  ok('cambiar PIN: rechaza PIN actual incorrecto',/actual no es correcto/.test(await r.page.textContent('#toast')));
  await r.page.fill('#pA','222222');await r.page.fill('#pN2','000000');await r.page.click('#dOk');await r.page.waitForTimeout(300);
  ok('cambiar PIN: rechaza si no coinciden',/no coinciden/.test(await r.page.textContent('#toast')));
  await r.page.fill('#pN2','654321');await r.page.click('#dOk');await r.page.waitForTimeout(500);
  ok('cambiar PIN: guardado',/PIN cambiado/.test(await r.page.textContent('#toast')));
  await r.page.click('#salir');await r.page.waitForSelector('#lu');
  await r.page.click('#lu button:has-text("Ricardo")');await r.page.fill('#lpin','222222');await r.page.click('#lgo');ok('PIN viejo ya no entra',/incorrecto/i.test(await r.page.textContent('#lerr')));
  await r.page.fill('#lpin','654321');await r.page.click('#lgo');await r.page.waitForSelector('#login',{state:'hidden'});ok('PIN nuevo entra',true);
  ok('el aviso no vuelve a salir si ya lo vio',!(await r.page.isVisible('#nov')));
  await r.page.evaluate(()=>localStorage.setItem('lns_crm_visto_ricardo','2026-10-09c'));await r.page.click('#salir');await r.page.waitForSelector('#lu');await r.page.click('#lu button:has-text("Ricardo")');await r.page.fill('#lpin','654321');await r.page.click('#lgo');await r.page.waitForSelector('#login',{state:'hidden'});
  ok('con novedades nuevas vuelve el aviso (+2 más)',/Instala la herramienta como aplicación/.test(await r.page.textContent('#nov'))&&/\+2 más/.test(await r.page.textContent('#nov')));
  await r.ctx.close();
  const b=await abrir({width:1280,height:900});await login(b.page,'Byron','111111');await b.page.click('nav button[data-t="semana"]');
  ok('jefe: ve Ajustes',!!(await b.page.$('#cSave')));
  await b.page.click('nav button[data-t="manual"]');await b.page.waitForTimeout(200);ok('manual: jefe ve la sección de jefe',/Solo jefe de taller/.test(await b.page.textContent('#manual')));await b.page.click('nav button[data-t="semana"]');
  await b.page.click('nav button[data-t="importar"]');await b.page.setInputFiles('#file',xlsx);await b.page.waitForSelector('#kCart',{timeout:60000});await b.page.waitForTimeout(600);
  await b.page.click('nav button[data-t="hoy"]');await b.page.waitForTimeout(300);ok('jefe: aviso de respaldo en Hoy cuando no hay',/respaldo/i.test(await b.page.textContent('#hoy')));
  await b.page.click('nav button[data-t="semana"]');
  await b.page.screenshot({path:path.join(out,'6-semana-jefe.png'),fullPage:true});
  // Jefe agrega a Jacobo (consulta), Jacobo entra, jefe lo desactiva
  await b.page.click('#uAdd');await b.page.fill('#uN','Jacobo');await b.page.selectOption('#uR','consulta');await b.page.fill('#uP','12');await b.page.click('#dOk');await b.page.waitForTimeout(300);
  ok('usuario nuevo: exige 6 dígitos',/6 dígitos/.test(await b.page.textContent('#toast')));
  await b.page.fill('#uP','777777');await b.page.click('#dOk');await b.page.waitForTimeout(600);
  ok('usuario nuevo: aparece en la tabla',/Jacobo/.test(await b.page.textContent('#semana')));
  await b.page.click('[data-upin="mario"]');await b.page.fill('#pN1','121212');await b.page.fill('#pN2','121212');await b.page.click('#dOk');await b.page.waitForTimeout(500);
  ok('jefe restablece PIN de otro',/restablecido/.test(await b.page.textContent('#toast')));
  await b.page.click('#salir');await b.page.waitForSelector('#lu');
  await b.page.click('#lu button:has-text("Jacobo")');await b.page.fill('#lpin','777777');await b.page.click('#lgo');await b.page.waitForSelector('#login',{state:'hidden'});
  ok('Jacobo (consulta) entra y no ve Importar',await b.page.isHidden('nav button[data-t="importar"]'));
  await b.page.click('#salir');await b.page.waitForSelector('#lu');await login(b.page,'Byron','111111');await b.page.click('nav button[data-t="semana"]');
  await b.page.click('[data-uact="jacobo"]');await b.page.waitForTimeout(600);
  ok('jefe desactiva a Jacobo',/Desactivado/.test(await b.page.textContent('#semana')));
  ok('el jefe no puede desactivarse a sí mismo',!(await b.page.$('[data-uact="byron"]')));
  await b.page.click('#salir');await b.page.waitForSelector('#lu');
  ok('Jacobo desactivado no aparece al entrar',!(await b.page.textContent('#lu')).includes('Jacobo'));
  await b.ctx.close();
  const m=await abrir({width:1280,height:900});await m.page.click('#lu button:has-text("Ricardo")');await m.page.fill('#lpin','000000');await m.page.click('#lgo');
  ok('PIN incorrecto rechazado',/incorrecto/i.test(await m.page.textContent('#lerr')));await m.ctx.close();
}
await browser.close();
console.log(fallos?`\n${fallos} FALLAS`:'\nTodo OK');process.exit(fallos?1:0);
