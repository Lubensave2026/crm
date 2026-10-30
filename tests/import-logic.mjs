// Prueba de aceptación de la lógica de importación con el Excel real (sin Firebase).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import XLSX from 'xlsx';
const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'..','index.html'),'utf8');
const bloque=html.split('/*@PURA-INICIO')[1].split('/*@PURA-FIN*/')[0].replace(/^[^\n]*\n/,'');
const HOY='2026-10-09';
const L=new Function('TODAY',bloque+';return {planImport,montoCaso,moCaso,abierto,computeAgenda,Q,filasRespaldo,pl,planEnlaces,tipoReporte,calcMes,incentivoCalc,listaMeses,mesTxt,pendientesAnteriores,recuperadoDetalle,planServicios,tipoServ,parseServ,parseExcl,PROS_DEF,visitasServ,analisisVeh,prospectos,sugerencias,esDiesel,kmEstimado,mensajePros,normPlaca,buscarHistorial}')(HOY);
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

// ---- Detalle de lo recuperado de la semana ----
{
  const P=(punto,total,rec)=>({punto,total,mo:total/10,estadoCM:rec?'Aprobado':'Pendiente',recuperada:!!rec});
  const base={estado:'Recuperado',seg:{},bitacora:[],recuperos:[]};
  const casos={
    CM:{...base,ot:'CM',cliente:'Ana',partidas:{a:P('Frenos',1500,true),b:P('Aceite',800,true),c:P('Llantas',3000,false)},recuperos:[{fecha:'2026-10-20',monto:1500,mo:150,tipo:'clear-mechanic',usuario:'Byron'},{fecha:'2026-10-14',monto:800,mo:80,tipo:'clear-mechanic',usuario:'Byron'}]},
    TOT:{...base,ot:'TOT',cliente:'Beto',partidas:{a:P('Batería',2000,true),b:P('Filtro',500,true)},recuperos:[{fecha:'2026-10-21',monto:2500,mo:250,tipo:'total',usuario:'Edson'}],bitacora:[{fecha:'2026-10-21',resultado:'Autorizado total',nota:'Q2,500 · autorizó todo'}]},
    PAR:{...base,estado:'En negociación',ot:'PAR',cliente:'Cora',partidas:{a:P('A/C',4000,false)},recuperos:[{fecha:'2026-10-22',monto:1000,mo:100,tipo:'parcial',usuario:'Edson'}],bitacora:[{fecha:'2026-10-22',resultado:'Autorizado parcial',nota:'Q1,000 · autorizó solo el gas'}]},
    FUERA:{...base,ot:'FUERA',cliente:'Dani',partidas:{a:P('X',900,true)},recuperos:[{fecha:'2026-10-10',monto:900,mo:90,tipo:'clear-mechanic'}]},
    NADA:{...base,estado:'Pendiente',ot:'NADA',cliente:'Eli',partidas:{}}
  };
  const d=L.recuperadoDetalle(casos,'2026-10-19','2026-10-24');
  ok('recuperado semana: total y autorizaciones',JSON.stringify([d.monto,d.autor,d.casos.length]),JSON.stringify([5000,3,3]));
  ok('recuperado semana: solo casos con recuperos en el rango',JSON.stringify(d.casos.map(x=>x.c.ot).sort()),JSON.stringify(['CM','PAR','TOT']));
  ok('recuperado semana: orden por fecha más reciente',JSON.stringify(d.casos.map(x=>x.c.ot)),JSON.stringify(['PAR','TOT','CM']));
  const cm=d.casos.find(x=>x.c.ot==='CM');
  ok('recuperado semana: Clear Mechanic trae su punto y monto (y no el de otra semana)',JSON.stringify(cm.items.map(i=>i.puntos.map(p=>p.punto+':'+p.total).join())),JSON.stringify(['Frenos:1500']));
  const tot=d.casos.find(x=>x.c.ot==='TOT');
  ok('recuperado semana: total manual lista las partidas recuperadas',JSON.stringify(tot.items[0].puntos.map(p=>p.punto).sort()),JSON.stringify(['Batería','Filtro']));
  const par=d.casos.find(x=>x.c.ot==='PAR');
  ok('recuperado semana: parcial manual muestra la nota, sin puntos',JSON.stringify([par.items[0].puntos.length,par.items[0].nota]),JSON.stringify([0,'autorizó solo el gas']));
  ok('recuperado semana: coincide con el total de la tarjeta (suma de recuperos del rango)',d.monto,Object.values(casos).flatMap(c=>c.recuperos).filter(r=>r.fecha>='2026-10-19'&&r.fecha<='2026-10-24').reduce((a,r)=>a+r.monto,0));
  ok('recuperado semana: sin recuperos devuelve vacío',L.recuperadoDetalle(casos,'2026-11-01','2026-11-06').casos.length,0);
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
// ---- Prospección de servicios de mantenimiento ----
{
  const aplicar=(vehs,pl)=>{for(const {key,data} of pl.escribir){const ex=vehs[key]||{};vehs[key]={...ex,...data,serv:{...(ex.serv||{}),...(data.serv||{})}}}};
  const vehs={};
  const ps=L.planServicios(rows,vehs,{});
  ok('servicios: sin error de formato',!!ps.error,false);
  ok('servicios: hay vehículos con servicio aprobado',ps.stats.vehiculos>50,true);
  ok('servicios: coinciden los vehículos nuevos con los escritos',ps.stats.nuevos,ps.escribir.length);
  aplicar(vehs,ps);
  const tipos=new Set(Object.values(vehs).flatMap(v=>Object.values(v.serv).filter(e=>!e.x).map(e=>e.t)));
  ok('servicios: solo tipos de la lista',[...tipos].every(t=>['Servicio menor','Servicio intermedio','Servicio mayor','Servicio mayor completo','Caja automática'].includes(t)),true);
  ok('servicios: reconoce menor, intermedio, mayor completo y caja',['Servicio menor','Servicio intermedio','Servicio mayor completo','Caja automática'].every(t=>tipos.has(t)),true);
  ok('servicios: toda llave es VIN o placa normalizada',Object.keys(vehs).every(k=>/^[vp][A-Z0-9]{5,17}$/.test(k)),true);
  ok('servicios: volver a cargar no escribe nada (no duplica)',L.planServicios(rows,structuredClone(vehs),{}).escribir.length,0);
  ok('servicios: rechazados no cuentan',Object.values(vehs).every(v=>Object.values(v.serv).every(e=>e.f&&e.ot)),true);
  const ex=L.parseExcl(L.PROS_DEF.excluir),sv=L.parseServ(L.PROS_DEF.servicios);
  ok('tipo: Servicio menor.',L.tipoServ('Servicio menor.',sv,ex),'Servicio menor');
  ok('tipo: SERVICIO MAYOR COMPLETO',L.tipoServ('SERVICIO MAYOR COMPLETO',sv,ex),'Servicio mayor completo');
  ok('tipo: Servicio mayor (no completo)',L.tipoServ('SERVICIO MAYOR',sv,ex),'Servicio mayor');
  ok('tipo: aceite de transmisión con filtro',L.tipoServ('ACEITE DE TRANSMISION (C/FILTRO)',sv,ex),'Caja automática');
  ok('tipo: sensor de aceite de caja NO es servicio',L.tipoServ('SENSOR DE PRECION DE ACEITE DE CAJA',sv,ex),null);
  ok('tipo: cargador de cola de caja NO es servicio',L.tipoServ('Cargador de cola de caja',sv,ex),null);
  ok('tipo: servicio del turbo NO es servicio',L.tipoServ('Servicio del turbo',sv,ex),null);
  ok('tipo: estado de fajas NO es servicio',L.tipoServ('ESTADO DE FAJAS',sv,ex),null);
  ok('placa normalizada',L.normPlaca('p-123 abc'),'P123ABC');

  // Un VIN y una placa sin VIN del mismo vehículo se unen en un solo documento
  const cab=['OR #','Fecha / Hora de apertura de Orden','Nombre','Apellido','Móvil','Marca','Modelo','Año','VIN','Kilometraje','Placas','Tipo','Punto de Inspección','Cotización - Total','Cotización - M.O.','¿Aprobado o Rechazado?'];
  const fila=(ot,f,vin,pl,km,pt,tot,est)=>[ot,new Date(f+'T12:00:00'),'Carlos','Mendez','55550000','Toyota','Hilux',2018,vin,km,pl,'Punto de Inspección',pt,'',0,est];
  const total=(ot,f,vin,pl,km,pt,tot,est)=>{const r=fila(ot,f,vin,pl,km,pt,tot,est);r[11]='Cotización - Total';r[13]=tot;return r};
  const v1=[cab,fila('1','2025-01-10','','P123ABC',50000,'SERVICIO MENOR',0,'Aprobado por Cliente'),total('1','2025-01-10','','P123ABC',50000,'SERVICIO MENOR',500,'Aprobado por Cliente'),
    fila('2','2025-08-10','3TMLU4EN5GM000001','P-123 ABC',60000,'SERVICIO INTERMEDIO',0,'Aprobado por Cliente'),total('2','2025-08-10','3TMLU4EN5GM000001','P-123 ABC',60000,'SERVICIO INTERMEDIO',900,'Aprobado por Cliente'),
    fila('2','2025-08-10','3TMLU4EN5GM000001','P-123 ABC',60000,'FAJA DE TIEMPO',0,'Rechazado'),total('2','2025-08-10','3TMLU4EN5GM000001','P-123 ABC',60000,'FAJA DE TIEMPO',3000,'Rechazado')];
  const vv={};const pv=L.planServicios(v1,vv,{});aplicar(vv,pv);
  ok('unión VIN/placa: un solo vehículo',Object.keys(vv).length,1);
  ok('unión VIN/placa: guarda el VIN',Object.values(vv)[0].vin,'3TMLU4EN5GM000001');
  ok('unión VIN/placa: dos servicios',Object.values(Object.values(vv)[0].serv).filter(e=>!e.x).length,2);
  ok('rechazado no cuenta como trabajo hecho',Object.values(Object.values(vv)[0].serv).some(e=>e.t==='Faja de tiempo'),false);
  ok('último nombre y teléfono',Object.values(vv)[0].nombre+'|'+Object.values(vv)[0].movil,'Carlos Mendez|55550000');
  ok('monto del servicio',Object.values(Object.values(vv)[0].serv).find(e=>e.t==='Servicio intermedio').m,900);

  // Vencidos y próximos
  const H='2026-10-28';
  const mk=(visitas,extra)=>({placa:'P111AAA',nombre:'Ana Lopez',marca:'Honda',modelo:'CR-V',anio:'2016',serv:Object.fromEntries(visitas.map(([f,t,km],i)=>['o'+i+'_'+t,{f,ot:'o'+i,t,km,m:100}])),...(extra||{})});
  const venc=mk([['2025-01-10','Servicio menor',50000],['2025-07-10','Servicio intermedio',58000],['2025-07-25','Servicio menor',59000]]);
  ok('visitas: las de menos de 20 días cuentan como una',L.visitasServ(venc).length,2);
  const a1=L.analisisVeh(venc,H);
  ok('vencido: último servicio hace 15 meses',a1.estado,'vencido');
  const a2=L.analisisVeh(mk([['2025-03-01','Servicio menor',40000],['2025-09-01','Servicio intermedio',50000]]),H);
  ok('vencido: 14 meses sin servicio',a2.estado,'vencido');
  ok('vencido: meses',a2.meses,13);
  ok('vencido: frecuencia en días',a2.freq,184);
  ok('más de 24 meses queda fuera',L.analisisVeh(mk([['2024-06-01','Servicio menor',40000]]),H).estado,null);
  const a3=L.analisisVeh(mk([['2026-02-01','Servicio menor',40000],['2026-04-01','Servicio intermedio',45000]]),H);
  ok('próximo: cada 2 meses (mínimo 90 días) y van 210 días',a3.estado,'proximo');
  ok('reciente: no es candidato',L.analisisVeh(mk([['2026-09-20','Servicio menor',40000]]),H).estado,null);
  ok('próximo al 85% de su frecuencia (180 d por defecto)',L.analisisVeh(mk([['2026-05-25','Servicio menor',40000]]),H).estado,'proximo');
  ok('antes del 85% todavía no',L.analisisVeh(mk([['2026-06-15','Servicio menor',40000]]),H).estado,null);
  const base=mk([['2025-03-01','Servicio menor',40000]]);
  ok('contacto: mensaje enviado hace 2 días → ya en contacto',L.analisisVeh({...base,contactos:[{f:'2026-10-26',res:'enviado',ts:1}]},H).cont,'contacto');
  ok('contacto: mensaje enviado hace 10 días → libre otra vez',L.analisisVeh({...base,contactos:[{f:'2026-10-18',res:'enviado',ts:1}]},H).cont,'libre');
  ok('contacto: agendó cita → en contacto',L.analisisVeh({...base,contactos:[{f:'2026-10-10',res:'agendo',ts:1}]},H).cont,'contacto');
  ok('contacto: más adelante con fecha futura',L.analisisVeh({...base,contactos:[{f:'2026-10-10',res:'mas-adelante',prox:'2026-12-01',ts:1}]},H).cont,'contacto');
  ok('contacto: más adelante ya vencido → libre',L.analisisVeh({...base,contactos:[{f:'2026-09-01',res:'mas-adelante',prox:'2026-10-01',ts:1}]},H).cont,'libre');
  ok('contacto: no tiene el vehículo → descartado',L.analisisVeh({...base,contactos:[{f:'2026-10-10',res:'sin-vehiculo',ts:1}]},H).cont,'descartado');
  ok('ya vino: sale de la lista',L.analisisVeh({...base,ya:{f:'2026-10-01'}},H).estado,null);
  ok('descartado antes de un servicio nuevo ya no cuenta',L.analisisVeh({...mk([['2025-03-01','Servicio menor',40000],['2025-10-20','Servicio menor',46000]]),contactos:[{f:'2025-06-01',res:'sin-vehiculo',ts:1}]},H).cont,'libre');
  // prospectos: ordena, marca caso abierto y quita descartados
  const casos={5001:{ot:'5001',placa:'P-111 AAA',estado:'Pendiente',partidas:{a:{punto:'a',total:500,mo:100,estadoCM:'Rechazado'}},recuperos:[]}};
  const lst=L.prospectos({a:base,b:{...base,placa:'P222BBB',contactos:[{f:'2026-10-10',res:'sin-vehiculo',ts:1}]}},casos,undefined,H);
  ok('prospectos: sin el descartado',lst.length,1);
  ok('prospectos: marca el caso abierto de la misma placa',lst[0].caso,'5001');

  // Sugerencias
  const hil={placa:'P1',marca:'Toyota',modelo:'Hilux',anio:'2018',serv:{a:{f:'2025-03-01',ot:'a',t:'Servicio menor',km:90000,m:1},b:{f:'2025-09-01',ot:'b',t:'Servicio mayor',km:99000,m:1}}};
  ok('diésel: Hilux sí',L.esDiesel(hil,L.PROS_DEF.diesel),true);
  ok('diésel: CR-V no',L.esDiesel({marca:'Honda',modelo:'CR-V'},L.PROS_DEF.diesel),false);
  const sg=L.sugerencias(hil,H).map(x=>x.nombre);
  ok('sugerencia: Hilux con ~110 mil km → faja de tiempo y EGR',sg.includes('Faja de tiempo')&&sg.includes('Limpieza de EGR'),true);
  ok('sugerencia: Hilux no lleva bujías (es diésel)',sg.includes('Bujías'),false);
  const gas=L.sugerencias({...hil,marca:'Honda',modelo:'CR-V'},H).map(x=>x.nombre);
  ok('sugerencia: gasolina no lleva EGR pero sí bujías',!gas.includes('Limpieza de EGR')&&gas.includes('Bujías'),true);
  const hecho={...hil,serv:{...hil.serv,c:{f:'2025-09-01',ot:'c',t:'Faja de tiempo',km:99000,m:1,x:1}}};
  ok('sugerencia: si la faja se hizo hace poco, no se sugiere',L.sugerencias(hecho,H).some(x=>x.nombre==='Faja de tiempo'),false);
  ok('sugerencia: sin kilometraje no sugiere nada',L.sugerencias({marca:'Kia',serv:{a:{f:'2025-03-01',ot:'a',t:'Servicio menor',km:0,m:1}}},H).length,0);
  ok('historial: guarda todas las órdenes del vehículo (también rechazadas)',Object.values(Object.values(vv)[0].ord).length===2&&Object.values(vv)[0].ord['2'].p.some(p=>p.n==='FAJA DE TIEMPO'&&p.e==='R'&&p.t===3000),true);
  ok('historial: cada orden trae fecha y km',Object.values(vv)[0].ord['1'].f==='2025-01-10'&&Object.values(vv)[0].ord['1'].km===50000,true);
  ok('historial: busca por placa con otro formato',L.buscarHistorial(vv,'p 123abc').length,1);
  ok('historial: busca por modelo y nombre juntos',L.buscarHistorial(vv,'hilux mendez').length,1);
  ok('historial: busca por número de OT',L.buscarHistorial(vv,'2').length,1);
  ok('historial: sin coincidencia',L.buscarHistorial(vv,'zzzz').length,0);
  ok('historial: orden de Firestore con otro orden de llaves no se reescribe',L.planServicios(v1,JSON.parse(JSON.stringify(vv),(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([x],[y])=>x<y?1:-1)):v),{}).escribir.length,0);
  ok('historial: vehículo sin servicios también queda guardado',(()=>{const r=[cab,fila('9','2026-01-10','','P555ZZZ',20000,'FRENOS DELANTEROS',0,'Aprobado por Cliente'),total('9','2026-01-10','','P555ZZZ',20000,'FRENOS DELANTEROS',800,'Aprobado por Cliente')];const x=L.planServicios(r,{},{});return x.stats.vehiculos===1&&Object.values(x.escribir[0].data.ord)[0].p[0].t===800})(),true);
  ok('mensaje: vencido incluye meses y firma',/Hace 13 meses/.test(L.mensajePros(a2,'Ricardo','Lube N Save Zona 10',[]))&&/Ricardo/.test(L.mensajePros(a2,'Ricardo','Lube N Save Zona 10',[])),true);
}
process.exit(fallos?1:0);
