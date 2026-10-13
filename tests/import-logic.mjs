// Prueba de aceptación de la lógica de importación con el Excel real (sin Firebase).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import XLSX from 'xlsx';
const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'..','index.html'),'utf8');
const bloque=html.split('/*@PURA-INICIO')[1].split('/*@PURA-FIN*/')[0].replace(/^[^\n]*\n/,'');
const HOY='2026-10-09';
const L=new Function('TODAY',bloque+';return {planImport,montoCaso,moCaso,abierto,computeAgenda,Q,filasRespaldo,pl,planEnlaces,tipoReporte,calcMes,incentivoCalc,listaMeses,mesTxt,pendientesAnteriores}')(HOY);
const xlsx=fs.readdirSync(path.join(dir,'fixtures')).find(f=>/Reporte de Actividad.*\.xlsx$/.test(f));
const wb=XLSX.read(fs.readFileSync(path.join(dir,'fixtures',xlsx)),{type:'buffer',cellDates:true});
const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true});
let fallos=0;const ok=(n,v,e)=>{const b=v===e;if(!b)fallos++;console.log((b?'OK  ':'FALLA')+' '+n+': '+v+(b?'':'  (esperado '+e+')'))};

const casos={};
const p1=L.planImport(rows,casos,{hoy:HOY,usuario:'test'});
for(const {ot,doc} of p1.nuevos)casos[ot]=doc;
const s=p1.stats,cart=()=>Object.values(casos).filter(L.abierto).reduce((a,c)=>a+L.montoCaso(c),0);
ok('filas',s.filas,3631);ok('órdenes',s.ordenes,179);ok('partidas',s.partidas,742);ok('casos nuevos',s.nuevos,102);
ok('cartera',Math.round(cart()),1068512);ok('avisos de calidad',s.avisos,54);

const p2=L.planImport(rows,structuredClone(casos),{hoy:HOY,usuario:'test'});
ok('reimport: nuevos',p2.stats.nuevos,0);ok('reimport: escrituras en casos',p2.nuevos.length+p2.cambios.length,0);

const c=casos['5381'];
c.recuperos.push({fecha:HOY,monto:22699,mo:0,tipo:'parcial'});
ok('parcial OT 5381: cartera',Math.round(cart()),1045813);

// Recuperación detectada: una partida rechazada pasa a Aprobado en una carga posterior
const k=Object.keys(c.partidas).find(x=>c.partidas[x].estadoCM!=='Aprobado'&&c.partidas[x].total>0);
const rows3=rows.map(r=>r.slice());const h=rows[0].map(x=>String(x).toLowerCase());
const iOt=h.findIndex(x=>x==='or #'),iPt=h.findIndex(x=>x.startsWith('punto de insp')),iEs=h.findIndex(x=>x.includes('aprobado o')),iTp=h.findIndex(x=>x==='tipo');
for(const r of rows3)if(String(r[iOt])==='5381'&&/total/i.test(String(r[iTp]))&&String(r[iPt]).trim()===c.partidas[k].punto)r[iEs]='Aprobado por Miembro del Equipo';
const p3=L.planImport(rows3,structuredClone(casos),{hoy:HOY,usuario:'test'});
ok('recuperado detectado',p3.stats.recuperados>=1,true);
ok('monto recuperado detectado',Math.round(p3.stats.montoRecuperado),Math.round(c.partidas[k].total));

const ag=L.computeAgenda(casos,{min:2,max:5},[]);
ok('agenda entre 2 y 5',ag.length>=2&&ag.length<=5,true);

const H=L.filasRespaldo(casos);
ok('respaldo: filas de Cartera',H.Cartera.length,102);
ok('respaldo: partidas = suma de partidas',H.Partidas.length,Object.values(casos).reduce((a,c)=>a+Object.keys(c.partidas).length,0));
ok('respaldo: bitácora (1 por caso + parcial)',H['Bitácora'].length,102);
ok('respaldo: recuperos',H.Recuperos.length,1);
ok('respaldo: pendiente suma = cartera',Math.round(H.Cartera.filter(r=>!['Recuperado','Perdido','En taller'].includes(r.Estado)).reduce((a,r)=>a+r['Pendiente Q'],0)),1045813);
ok('plural 1',L.pl(1,'caso','casos'),'1 caso');ok('plural 2',L.pl(2,'caso','casos'),'2 casos');

// ---- Enlaces de inspección (Formas de Inspección) ----
const fx=fs.readdirSync(path.join(dir,'fixtures')).find(f=>/Formas.*\.xlsx$/.test(f)&&!f.startsWith('~'));
if(fx){
  const wb2=XLSX.read(fs.readFileSync(path.join(dir,'fixtures',fx)),{type:'buffer',cellDates:true});
  const rowsE=XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]],{header:1,raw:true});
  ok('tipo: cotizaciones',L.tipoReporte(rows),'cotizaciones');ok('tipo: enlaces',L.tipoReporte(rowsE),'enlaces');
  const e1=L.planEnlaces(rowsE,{});
  ok('enlaces: filas',e1.stats.filas,220);ok('enlaces: nuevos',e1.stats.nuevos,220);ok('enlaces: inválidos',e1.stats.invalidos,0);
  ok('enlaces: formato',/^https:\/\/vehi\.mobi\/\w+$/.test(e1.cambios['5431']),true);
  const e2=L.planEnlaces(rowsE,e1.cambios);
  ok('reimport enlaces: sin cambios',Object.keys(e2.cambios).length,0);ok('reimport enlaces: iguales',e2.stats.iguales,220);
  const e3=L.planEnlaces(rowsE,{...e1.cambios,'5431':'https://vehi.mobi/viejo'});
  ok('enlace distinto se actualiza',e3.stats.actualizados,1);
  const ab=Object.values(casos).filter(L.abierto);
  ok('casos abiertos con enlace',ab.filter(c=>e1.cambios[c.ot]).length,ab.length-2);
  ok('respaldo trae el enlace',L.filasRespaldo(casos,e1.cambios).Cartera.filter(r=>r['Enlace de inspección']).length,ab.length-2+Object.values(casos).filter(c=>!L.abierto(c)&&e1.cambios[c.ot]).length);
  const raro=rowsE.map(r=>r.slice());const iU=raro[0].findIndex(h=>String(h).toLowerCase().includes('orden digital')),iR=raro.findIndex((r,i)=>i>0&&r[0]);raro[iR][iU]='javascript:alert(1)';
  ok('rechaza enlaces que no son https',L.planEnlaces(raro,{}).stats.invalidos,1);
  ok('error si falta Orden digital',L.planEnlaces([['OR #','Nombre']],{}).error[0],'Orden digital');
}

// ---- Cierre mensual ----
const cfg={meta:100000,pct1:1,pct2:2.5,base:'total'};
ok('incentivo: sobre la meta (130K → Q1,750)',L.incentivoCalc(130000,cfg),1750);
ok('incentivo: bajo la meta (50K → Q500)',L.incentivoCalc(50000,cfg),500);
ok('incentivo: exacto en la meta',L.incentivoCalc(100000,cfg),1000);
const cm={'1':{ot:'1',estado:'Pendiente',partidas:{},recuperos:[{fecha:'2026-10-03',monto:22699,mo:5000,tipo:'parcial'},{fecha:'2026-09-30',monto:1000,mo:200,tipo:'total'}],bitacora:[{fecha:'2026-10-03',canal:'WhatsApp'},{fecha:'2026-10-03',canal:'Sistema'},{fecha:'2026-09-30',canal:'Llamada'}]},
 '2':{ot:'2',estado:'Recuperado',partidas:{},recuperos:[{fecha:'2026-10-20',monto:10000,mo:3000,tipo:'total'}],bitacora:[{fecha:'2026-10-20',canal:'WhatsApp'},{fecha:'2026-10-21',canal:'Clear Mechanic'}]}};
const oct=L.calcMes(cm,cfg,'2026-10'),sep=L.calcMes(cm,cfg,'2026-09');
ok('mes: recuperado de octubre',oct.recuperado,32699);ok('mes: M.O. de octubre',oct.recuperadoMO,8000);ok('mes: autorizaciones de octubre',oct.autorizados,2);
ok('mes: contactos (sin Sistema ni Clear Mechanic)',oct.contactos,2);ok('mes: septiembre separado',sep.recuperado,1000);
ok('mes: incentivo octubre (32,699 × 1%)',oct.incentivo,326.99);
ok('mes: base por mano de obra',L.calcMes(cm,{...cfg,base:'mo'},'2026-10').incentivo,80);
ok('meses: lista hacia atrás cruzando el año',JSON.stringify(L.listaMeses('2026-01-15',3)),JSON.stringify(['2026-01','2025-12','2025-11']));
ok('meses: texto',L.mesTxt('2026-10'),'octubre 2026');

// ---- Pendientes de días anteriores ----
{
  const mk=(ot,extra)=>({ot,estado:'Pendiente',sem:'amarillo',fecha:'2026-10-01',seg:{},bitacora:[],recuperos:[],proximo:null,partidas:{a:{punto:'a',total:1000,mo:100,estadoCM:'Pendiente',recuperada:false}},...extra});
  const casos={A:mk('A'),B:mk('B',{bitacora:[{fecha:'2026-10-12',canal:'WhatsApp',resultado:'Sin respuesta'}]}),C:mk('C',{estado:'Perdido'}),D:mk('D',{proximo:'2026-10-20'}),E:mk('E'),F:mk('F'),G:mk('G',{bitacora:[{fecha:'2026-10-12',canal:'Sistema',resultado:'En taller'}]}),H:mk('H',{partidas:{a:{punto:'a',total:1000,mo:100,estadoCM:'Aprobado',recuperada:false}}})};
  const ag={'2026-10-11':['A','B','C'],'2026-10-12':['D','E','G','H'],'2026-10-13':['F'],'2026-09-01':['A']};
  const pa=L.pendientesAnteriores(casos,ag,'2026-10-13').map(x=>x.c.ot+':'+x.dia);
  ok('pendientes: sin contacto posterior (A)',pa.includes('A:2026-10-11'),true);
  ok('pendientes: contactado después no aparece (B)',pa.some(x=>x.startsWith('B')),false);
  ok('pendientes: cerrado no aparece (C)',pa.some(x=>x.startsWith('C')),false);
  ok('pendientes: reprogramado a futuro no aparece (D)',pa.some(x=>x.startsWith('D')),false);
  ok('pendientes: un movimiento de Sistema no cuenta como contacto (G)',pa.includes('G:2026-10-12'),true);
  ok('pendientes: sin monto pendiente no aparece (H)',pa.some(x=>x.startsWith('H')),false);
  ok('pendientes: los de la lista de hoy no se repiten (F)',pa.some(x=>x.startsWith('F')),false);
  ok('pendientes: agendas de hace más de 14 días se ignoran y gana el día más antiguo',pa.filter(x=>x.startsWith('A')).length,1);
  ok('pendientes: orden por antigüedad',pa[0].startsWith('A'),true);
  ok('pendientes: si ya está en la lista de hoy deja de ser pendiente',L.pendientesAnteriores(casos,{...ag,'2026-10-13':['F','A']},'2026-10-13').some(x=>x.c.ot==='A'),false);
}

// ---- Formato nuevo del reporte de Clear Mechanic (encabezado "Fecha / Hora de apertura de Orden") ----
{
  const fn=path.join(dir,'fixtures','Cotizaciones-formato-nuevo.xlsx');
  if(fs.existsSync(fn)){
    const wbn=XLSX.read(fs.readFileSync(fn),{type:'buffer',cellDates:true});
    const rn=XLSX.utils.sheet_to_json(wbn.Sheets[wbn.SheetNames[0]],{header:1,raw:true});
    const pn=L.planImport(rn,{},{hoy:'2026-10-13',usuario:'t'});
    ok('formato nuevo: se lee',!!pn.stats&&pn.stats.nuevos>0,true);
    ok('formato nuevo: todos los casos nuevos traen fecha',pn.nuevos.filter(x=>!/^\d{4}-\d{2}-\d{2}$/.test(x.doc.fecha)).length,0);
    // casos que quedaron sin fecha en producción se reparan al volver a importar
    const rotos=structuredClone(Object.fromEntries(pn.nuevos.map(x=>[x.ot,{...x.doc,fecha:''}])));
    const pr=L.planImport(rn,rotos,{hoy:'2026-10-13',usuario:'t'});
    ok('reparación: reimportar completa la fecha vacía',pr.cambios.length>0&&pr.cambios.every(c=>/^\d{4}-\d{2}-\d{2}$/.test(c.patch.fecha||'')),true);
    // sin columna de fecha, el archivo se rechaza
    const sinF=rn.map(r=>r.filter((_,i)=>i!==2&&i!==3));
    ok('sin columna de fecha: se rechaza el archivo',(L.planImport(sinF,{},{}).error||[]).includes('fecha'),true);
  }
}

// ---- Lo registrado en la herramienta manda sobre el Excel ----
{
  const base={};for(const {ot,doc} of L.planImport(rows,{},{hoy:HOY,usuario:'t'}).nuevos)base[ot]=doc;
  for(const [est,nota] of [['En taller','En taller'],['Recuperado','Recuperado'],['En negociación','En negociación'],['Perdido','Perdido']]){
    const cs=structuredClone(base);const c=cs['5381'];c.estado=est;if(est!=='En negociación')for(const p of Object.values(c.partidas))if(p.estadoCM!=='Aprobado')p.recuperada=true;
    const pl2=L.planImport(rows,cs,{hoy:HOY,usuario:'t'});const ch=pl2.cambios.find(x=>x.ot==='5381');
    ok('recarga con el Excel como pendiente: no cambia el estado ('+nota+')',!ch||ch.patch.estado===undefined,true);
    ok('recarga: lo recuperado sigue sin pendiente ('+nota+')',est==='En negociación'?L.montoCaso(c)>0:L.montoCaso(c)===0,true);
  }
  // Una orden nueva (otra OT) con las partidas aprobadas no crea un caso ni cuenta otra vez
  const nueva=rows.map(r=>r.slice());const hh=rows[0].map(x=>String(x).toLowerCase());const iO=hh.findIndex(x=>x==='or #'),iE=hh.findIndex(x=>x.includes('aprobado o'));
  for(const r of nueva)if(String(r[iO])==='5381'){r[iO]='9999';r[iE]='Aprobado por Miembro del Equipo'}
  const pn=L.planImport(nueva,structuredClone(base),{hoy:HOY,usuario:'t'});
  ok('orden nueva ya aprobada (otra OT): no crea caso nuevo',pn.nuevos.some(x=>x.ot==='9999'),false);
}
process.exit(fallos?1:0);
