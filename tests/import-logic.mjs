// Prueba de aceptación de la lógica de importación con el Excel real (sin Firebase).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import XLSX from 'xlsx';
const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'..','index.html'),'utf8');
const bloque=html.split('/*@PURA-INICIO')[1].split('/*@PURA-FIN*/')[0].replace(/^[^\n]*\n/,'');
const HOY='2026-10-09';
const L=new Function('TODAY',bloque+';return {planImport,montoCaso,moCaso,abierto,computeAgenda,Q,filasRespaldo,pl,planEnlaces,tipoReporte,calcMes,incentivoCalc,listaMeses,mesTxt,pendientesAnteriores,recuperadoDetalle,planServicios,tipoServ,parseServ,parseExcl,PROS_DEF,visitasServ,analisisVeh,prospectos,esOtraSede,causaRiesgo,armarMensaje,sugerencias,esDiesel,kmEstimado,mensajePros,normPlaca,buscarHistorial,embudoDetalle}')(HOY);
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

// Solo órdenes cerradas entran como casos nuevos (cerradas = mapa OT → true/false que viene de Formas de Inspección)
{const ots=p1.nuevos.map(x=>x.ot);
 const pS=L.planImport(rows,{},{hoy:HOY,usuario:'test',cerradas:{}});
 ok('cerradas: sin dato de cierre no se crea ningún caso',pS.stats.nuevos,0);
 ok('cerradas: se reportan como omitidas (sin dato)',pS.stats.omitidas.n+'/'+pS.stats.omitidas.sinDato,ots.length+'/'+ots.length);
 const cer={};ots.slice(0,10).forEach(o=>cer[o]=true);ots.slice(10,15).forEach(o=>cer[o]=false);
 const pP=L.planImport(rows,{},{hoy:HOY,usuario:'test',cerradas:cer});
 ok('cerradas: solo entran las órdenes cerradas',pP.stats.nuevos,10);
 ok('cerradas: abiertas y sin dato se distinguen',pP.stats.omitidas.abiertas+'/'+pP.stats.omitidas.sinDato,'5/'+(ots.length-15));
 ok('cerradas: el monto omitido suma lo pendiente',pP.stats.omitidas.monto>0,true);
 const todas={};ots.forEach(o=>todas[o]=true);
 ok('cerradas: con todas cerradas entra lo mismo que antes',L.planImport(rows,{},{hoy:HOY,usuario:'test',cerradas:todas}).stats.nuevos,ots.length);
 // un caso que ya existe NO se toca por la regla: sigue detectando recuperados aunque la orden no figure como cerrada
 ok('cerradas: casos existentes siguen detectando lo aprobado',L.planImport(rows3,structuredClone(casos),{hoy:HOY,usuario:'test',cerradas:{}}).stats.recuperados>=1,true);
 // planEnlaces lee "Última comunicación"
 const re=[['OR #','Orden digital','Última comunicación'],['9001','https://vehi.mobi/a','Cerrada'],['9002','https://vehi.mobi/b','WA Enviado'],['9003','https://vehi.mobi/c','Aprobado por Miembro del Equipo']];
 const pe=L.planEnlaces(re,{},{});
 ok('enlaces: detecta cerradas',JSON.stringify(pe.cerrCambios),JSON.stringify({'9001':true,'9002':false,'9003':false}));
 ok('enlaces: reimport sin cambios de cierre',Object.keys(L.planEnlaces(re,pe.cambios,pe.cerrCambios).cerrCambios).length,0);
 re[2][2]='Cerrada';
 ok('enlaces: una orden que se cierra se actualiza',JSON.stringify(L.planEnlaces(re,pe.cambios,pe.cerrCambios).cerrCambios),JSON.stringify({'9002':true}));}
// Agenda: más antiguo primero; lo asignado antes y sin movimiento va al frente; alerta de casos sin movimiento
{const mk=(ot,f,monto)=>({ot,cliente:'C'+ot,fecha:f,estado:'Pendiente',sem:'amarillo',seg:{},bitacora:[],recuperos:[],proximo:null,partidas:{p:{punto:'x',total:monto,mo:0,estadoCM:'Pendiente',recuperada:false}}});
 const cs={A:mk('A','2026-10-08',9000),B:mk('B','2026-09-20',100),C:mk('C','2026-10-05',500),D:mk('D','2026-08-01',50)};
 ok('agenda: más antiguo primero (no por monto)',L.computeAgenda(cs,{min:2,max:5},[]).join(''),'DBC');
 ok('agenda: lo asignado antes y sin movimiento va primero',L.computeAgenda(cs,{min:2,max:5},[],['C']).join(''),'CDB');
 ok('agenda: el tope por día se respeta',L.computeAgenda(cs,{min:2,max:2},[],[]).join(''),'DB');
 const ag2={'2026-10-07':['C','B'],'2026-10-08':['D']};
 cs.B.bitacora.push({fecha:'2026-10-08',canal:'WhatsApp',resultado:'Enviado'});
 const sm=L.pendientesAnteriores(cs,ag2,HOY,30,true);
 ok('alerta: lista los asignados sin movimiento (el contactado no)',sm.map(x=>x.c.ot+x.dia).join(','),'C2026-10-07,D2026-10-08');
 ok('alerta: incluye los que ya están en la lista de hoy',L.pendientesAnteriores(cs,{...ag2,[HOY]:['C']},HOY,30,true).length,2);
 ok('pendientes de días anteriores: sin "todos" no repite los de hoy',L.pendientesAnteriores(cs,{...ag2,[HOY]:['C']},HOY).length,1);}
// Casos eliminados (Descartado): no cuentan como abiertos, no detectan recuperos al importar y no ensucian el embudo
{const ds=structuredClone(casos);const ot0=Object.keys(ds).find(o=>ds[o].estado==='Pendiente'||ds[o].estado==='Rechazado');ds[ot0].estado='Descartado';
 ok('descartado: ya no es un caso abierto',L.abierto(ds[ot0]),false);
 const pd=L.planImport(rows,structuredClone(ds),{hoy:HOY,usuario:'test'});
 ok('descartado: reimportar no lo reabre ni lo toca',pd.cambios.some(x=>x.ot===ot0&&(x.patch.estado||x.patch.recuperos)),false);
 const k0=Object.keys(ds[ot0].partidas).find(x=>ds[ot0].partidas[x].estadoCM!=='Aprobado'&&ds[ot0].partidas[x].total>0);
 const rd=rows.map(r=>r.slice());for(const r of rd)if(String(r[iOt])===ot0&&/total/i.test(String(r[iTp]))&&String(r[iPt]).trim()===ds[ot0].partidas[k0].punto)r[iEs]='Aprobado por Miembro del Equipo';
 const pa=L.planImport(rd,structuredClone(ds),{hoy:HOY,usuario:'test'});
 ok('descartado: si el cliente autoriza luego, no cuenta como recuperado',(pa.cambios.find(x=>x.ot===ot0)||{patch:{}}).patch.recuperos===undefined&&pa.stats.recuperados===0,true);
 const eA=L.embudoDetalle(casos),eD=L.embudoDetalle(ds);
 ok('descartado: sale del embudo (cotizado y durmiendo)',eD.cot<eA.cot&&eD.dorm<eA.dorm,true);
 ok('descartado: el embudo sigue cuadrando (otros no cambia)',Math.round(eD.otros),Math.round(eA.otros));}
// Mensaje de recuperación: brecha, causa, evidencia y acción
{const base={n:'Diego',veh:'Mazda CX-5 2022',asesor:'Ricardo',sede:'Lube N Save Zona 10',tit:'aro de llanta y cambio de llanta delantera izquierda',tot:'Q1,850',lk:'https://vehi.mobi/URs5v4'};
 const cr=L.causaRiesgo(['Aro de llanta','Cambio de llanta delantera izquierda'],'amarillo');
 ok('causa: llantas y aros',/agarre y estabilidad/.test(cr.c),true);
 ok('causa: frenos',/frenado/.test(L.causaRiesgo(['Pastillas de freno traseras'],'amarillo').c),true);
 ok('causa: embrague gana a disco',/embrague/.test(L.causaRiesgo(['Disco de embrague'],'amarillo').c),true);
 ok('causa: batería',/arranque/.test(L.causaRiesgo(['ESTADO DE BATERIA'],'amarillo').r),true);
 ok('causa: sin coincidencia y crítico',/prioritario/.test(L.causaRiesgo(['Algo raro'],'rojo').c),true);
 ok('causa: sin coincidencia y preventivo',/preventivo/.test(L.causaRiesgo(['Algo raro'],'amarillo').c),true);
 ok('causa: no confunde palabras parecidas (claro/aro)',/preventivo/.test(L.causaRiesgo(['Tapa clara'],'amarillo').c),true);
 const m1=L.armarMensaje({...base,etapa:'',cr}),m7=L.armarMensaje({...base,etapa:'s7',cr}),m30=L.armarMensaje({...base,etapa:'s30',cr});
 ok('mensaje 1: tiene brecha, causa, evidencia y acción',['quedó pendiente','Por qué le recomendamos','Evidencia','Lo que le proponemos'].every(x=>m1.includes(x)),true);
 ok('mensaje 1: avisa que el monto pudo variar y lleva el precio',m1.includes('Q1,850')&&/pudo|puede haber variado/.test(m1),true);
 ok('mensaje 1: enlace en su propia línea',m1.includes('\nhttps://vehi.mobi/URs5v4\n'),true);
 ok('mensaje 1: firma con la frase de Lube N Save',m1.endsWith('_Save it now, get it yesterday_'),true);
 ok('mensaje 7 días: propone lo urgente y aclara el monto',/lo más urgente \(Q1,850; el monto puede haber variado/.test(m7)&&m7.includes('Evidencia'),true);
 ok('mensaje 30 días: recordatorio suave con car wash',/car wash/.test(m30)&&/ayuda a evitar/.test(m30),true);
 ok('mensaje: sin enlace no deja un texto roto',!/undefined|null/.test(L.armarMensaje({...base,lk:null,etapa:'',cr})),true);
 ok('mensaje: las tres versiones son distintas',new Set([m1,m7,m30]).size,3);}
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
// ---- Fecha real de aprobación de Clear Mechanic ----
{
  const H2='2026-11-04';
  const cab=['OR #','Fecha / Hora de apertura de Orden','Nombre','Apellido','Móvil','Marca','Modelo','Año','Kilometraje','Placas','Tipo','Punto de Inspección','Cotización - Total','Cotización - M.O.','¿Aprobado o Rechazado?','Cotización - Fecha / Hora de Aprobación'];
  const R=(ot,pt,tot,est,ap)=>[[ot,'2026-10-05','A','B','5555','K','M',2020,1000,'P1','Punto de Inspección',pt,'',0,est,ap],[ot,'2026-10-05','A','B','5555','K','M',2020,1000,'P1','Cotización - Total',pt,tot,0,est,ap]];
  const caso=(rec,pa)=>({ot:'1',cliente:'A B',vehiculo:'K M 2020',placa:'P1',movil:'5555',km:'1000',fecha:'2026-10-05',estado:'Pendiente',sem:'amarillo',proximo:null,motivo:'',seg:{},bitacora:[],recuperos:rec,partidas:pa});
  const pend={A:{punto:'A',total:1000,mo:0,estadoCM:'Rechazado',fechaCM:'2026-10-05',recuperada:false}};
  // 1. Una aprobación nueva toma la fecha de aprobación, no la de la carga
  let pl1=L.planImport([cab,...R('1','A',1000,'Aprobado por Cliente','2026-10-26T15:14:00')],{1:caso([],structuredClone(pend))},{hoy:H2,usuario:'t'});
  ok('aprobación: el recupero nuevo toma la fecha de aprobación de CM',pl1.cambios[0].patch.recuperos[0].fecha,'2026-10-26');
  // 2. Sin fecha de aprobación en el reporte: se usa la de la carga
  pl1=L.planImport([cab,...R('1','A',1000,'Aprobado por Cliente','')],{1:caso([],structuredClone(pend))},{hoy:H2,usuario:'t'});
  ok('aprobación: sin fecha en el reporte, se usa la de la carga',pl1.cambios[0].patch.recuperos[0].fecha,H2);
  // 3. Una fecha futura no vale
  pl1=L.planImport([cab,...R('1','A',1000,'Aprobado por Cliente','2026-12-31T10:00:00')],{1:caso([],structuredClone(pend))},{hoy:H2,usuario:'t'});
  ok('aprobación: una fecha futura se ignora',pl1.cambios[0].patch.recuperos[0].fecha,H2);
  // 4. Se corrige un recupero ya guardado con la fecha de la carga
  const ya={A:{punto:'A',total:1000,mo:0,estadoCM:'Aprobado',fechaCM:'2026-10-05',recuperada:true}};
  const guardado=caso([{fecha:H2,monto:1000,mo:0,tipo:'clear-mechanic',usuario:'t'}],structuredClone(ya));guardado.estado='Recuperado';
  const pc=L.planImport([cab,...R('1','A',1000,'Aprobado por Cliente','2026-10-26T15:14:00')],{1:structuredClone(guardado)},{hoy:H2,usuario:'t'});
  ok('corrección: el recupero guardado pasa a la fecha real',pc.cambios[0].patch.recuperosAll[0].fecha,'2026-10-26');
  ok('corrección: cuenta 1 corregido por Q1,000',pc.stats.corregidos+'|'+pc.stats.montoCorregido,'1|1000');
  ok('corrección: movimiento noviembre -1000 y octubre +1000',pc.stats.movido['2026-11']+'|'+pc.stats.movido['2026-10'],'-1000|1000');
  ok('corrección: deja nota en la bitácora (canal Sistema)',pc.cambios[0].patch.bitacora.some(b=>b.canal==='Sistema'&&/Fecha de recuperación corregida/.test(b.resultado)),true);
  // 5. Volver a cargar el mismo reporte ya no cambia nada
  const corr=structuredClone(guardado);corr.recuperos[0].fecha='2026-10-26';
  const p2=L.planImport([cab,...R('1','A',1000,'Aprobado por Cliente','2026-10-26T15:14:00')],{1:corr},{hoy:H2,usuario:'t'});
  ok('corrección: la segunda carga no escribe nada',p2.cambios.length+p2.nuevos.length+p2.stats.corregidos,0);
  // 6. Lo registrado a mano y lo que ya tiene fecha anterior no se toca
  const manual=caso([{fecha:H2,monto:1000,mo:0,tipo:'total',usuario:'t'}],structuredClone(ya));
  const pm=L.planImport([cab,...R('1','A',1000,'Aprobado por Cliente','2026-10-26T15:14:00')],{1:manual},{hoy:H2,usuario:'t'});
  ok('corrección: un recupero registrado a mano no se toca',pm.stats.corregidos,0);
  const antes=caso([{fecha:'2026-10-20',monto:1000,mo:0,tipo:'clear-mechanic',usuario:'t'}],structuredClone(ya));
  ok('corrección: si la fecha guardada ya es anterior a la aprobación no se mueve',L.planImport([cab,...R('1','A',1000,'Aprobado por Cliente','2026-10-26T15:14:00')],{1:antes},{hoy:H2,usuario:'t'}).stats.corregidos,0);
}
// ---- Recuperado = lo aprobado hoy en Clear Mechanic, sin duplicar las autorizaciones parciales ----
{
  const H2='2026-11-04';
  const cab=['OR #','Fecha / Hora de apertura de Orden','Nombre','Apellido','Móvil','Marca','Modelo','Año','Kilometraje','Placas','Tipo','Punto de Inspección','Cotización - Total','Cotización - M.O.','¿Aprobado o Rechazado?'];
  const R=(pt,tot,est)=>[['9','2026-10-05','A','B','5555','K','M',2020,1000,'P1','Punto de Inspección',pt,'',0,est],['9','2026-10-05','A','B','5555','K','M',2020,1000,'P1','Cotización - Total',pt,tot,0,est]];
  const aplicar=(c,pl)=>{const x=structuredClone(c);for(const {ot,patch} of pl.cambios){if(ot!=='9')continue;if(patch.partidas)Object.assign(x.partidas,patch.partidas);if(patch.estado)x.estado=patch.estado;if(patch.recuperosAll)x.recuperos=patch.recuperosAll;else if(patch.recuperos)x.recuperos.push(...patch.recuperos)}return x};
  const tot=c=>Math.round(c.recuperos.reduce((a,r)=>a+r.monto,0)*100)/100;
  const pend=()=>({ot:'9',cliente:'A B',vehiculo:'K M 2020',placa:'P1',movil:'5555',km:'1000',fecha:'2026-10-05',estado:'En negociación',sem:'amarillo',proximo:null,motivo:'',seg:{},bitacora:[],recuperos:[],partidas:{A:{punto:'A',total:954,mo:0,estadoCM:'Pendiente',fechaCM:'2026-10-05',recuperada:false},B:{punto:'B',total:3710,mo:0,estadoCM:'Pendiente',fechaCM:'2026-10-05',recuperada:false}}});
  const nuevoRows=[cab,...R('A',591,'Aprobado por Cliente'),...R('B',940.8,'Aprobado por Cliente')];
  // 1. El precio aprobado hoy manda (no el cotizado antes)
  let c0=pend();let pl=L.planImport(nuevoRows,{9:c0},{hoy:H2,usuario:'t'});
  ok('precio: se recupera lo aprobado hoy y no lo cotizado antes',tot(aplicar(c0,pl)),1531.8);
  // 2. Autorización parcial previa: no se suma dos veces
  c0=pend();c0.recuperos.push({fecha:'2026-10-30',monto:1868,mo:0,tipo:'parcial',usuario:'R'});
  pl=L.planImport(nuevoRows,{9:c0},{hoy:H2,usuario:'t'});let x=aplicar(c0,pl);
  ok('parcial: 1,868 de parcial + 1,531.80 aprobado = 1,868 (no 3,399.80)',tot(x),1868);
  ok('parcial: lo absorbido queda anotado',Math.round(x.recuperos.reduce((a,r)=>a+(r.abs||0),0)*100)/100,1531.8);
  ok('parcial: el aviso cuenta el caso y el monto absorbido',pl.stats.ajustados.n+'|'+pl.stats.ajustados.parcial,'1|1531.8');
  ok('parcial: queda en la bitácora del caso',pl.cambios[0].patch.bitacora.some(b=>b.canal==='Sistema'&&/Recuperación ajustada/.test(b.resultado)),true);
  ok('parcial: lo pendiente del caso no se cuenta dos veces',L.montoCaso(x),0);
  ok('parcial: el recupero en 0 que guarda lo absorbido no cuenta como autorización',x.recuperos.filter(r=>r.monto>0).length,1);
  // 3. Volver a cargar el mismo reporte no cambia nada
  ok('parcial: la segunda carga no ajusta otra vez',L.planImport(nuevoRows,{9:x},{hoy:H2,usuario:'t'}).stats.ajustados.n,0);
  // 4. Estado heredado del código viejo (monto = cotizado anterior): se repara al cargar de nuevo
  const viejo=pend();viejo.recuperos.push({fecha:'2026-10-30',monto:1868,mo:0,tipo:'parcial',usuario:'R'},{fecha:'2026-10-31',monto:954,mo:0,tipo:'clear-mechanic',usuario:'B'},{fecha:'2026-10-31',monto:3710,mo:0,tipo:'clear-mechanic',usuario:'B'});
  viejo.partidas.A={punto:'A',total:591,mo:0,estadoCM:'Aprobado',fechaCM:'2026-10-05',recuperada:true};viejo.partidas.B={punto:'B',total:940.8,mo:0,estadoCM:'Aprobado',fechaCM:'2026-10-05',recuperada:true};viejo.estado='Recuperado';
  ok('heredado: antes del ajuste suma 6,532',tot(viejo),6532);
  pl=L.planImport(nuevoRows,{9:viejo},{hoy:H2,usuario:'t'});x=aplicar(viejo,pl);
  ok('heredado: se repara a 1,868',tot(x),1868);
  ok('heredado: separa precio (3,132.20) y parcial (1,531.80)',pl.stats.ajustados.casos[0].ex+'|'+pl.stats.ajustados.casos[0].ab,'3132.2|1531.8');
  ok('heredado: segunda carga sin cambios',L.planImport(nuevoRows,{9:x},{hoy:H2,usuario:'t'}).stats.ajustados.n,0);
  // 5. Sin parcial y sin cambio de precio: no se toca nada
  const limpio=pend();limpio.partidas.A.total=591;limpio.partidas.B.total=940.8;
  ok('sin parcial ni cambio de precio no ajusta',L.planImport(nuevoRows,{9:limpio},{hoy:H2,usuario:'t'}).stats.ajustados.n,0);
  // 6. Lo registrado a mano como autorización total no se toca
  const tt=pend();tt.recuperos.push({fecha:'2026-10-30',monto:4664,mo:0,tipo:'total',usuario:'R'});
  ok('autorización total a mano no se descuenta',tot(aplicar(tt,L.planImport(nuevoRows,{9:tt},{hoy:H2,usuario:'t'}))),4664+1531.8);
}
// ---- Embudo de la cartera ----
{
  const P=(t,e)=>({punto:'p'+t,total:t,mo:0,estadoCM:e,recuperada:false});
  const cs={
    1:{ot:'1',estado:'Pendiente',partidas:{a:P(1000,'Rechazado')},recuperos:[]},
    2:{ot:'2',estado:'Perdido',motivo:'Precio',partidas:{a:P(3000,'Rechazado')},recuperos:[]},
    3:{ot:'3',estado:'En taller',partidas:{a:P(500,'Aprobado')},recuperos:[]},
    4:{ot:'4',estado:'Recuperado',descuento:200,partidas:{a:{...P(2000,'Aprobado'),recuperada:true}},recuperos:[{fecha:'2026-10-05',monto:1800,mo:0,tipo:'total'}]},
    5:{ot:'5',estado:'Perdido',partidas:{a:{...P(1500,'Aprobado'),recuperada:true},b:P(700,'Rechazado')},recuperos:[{fecha:'2026-10-05',monto:1500,mo:0,tipo:'parcial'}]}};
  const E=L.embudoDetalle(cs);
  ok('embudo: no aprobado en CM',E.cot,1000+3000+2000+1500+700);
  ok('embudo: recuperado',E.rec,3300);ok('embudo: descuentos',E.desc,200);
  ok('embudo: perdido (lo que no se recuperó de los casos perdidos)',E.perdido,3000+700);
  ok('embudo: casos perdidos ordenados por monto',E.perdidos.map(x=>x.c.ot).join(','),'2,5');
  ok('embudo: sigue dormido',E.dorm,1000);
  ok('embudo: la suma cuadra (sin otros ajustes)',E.cot-E.rec-E.desc-E.perdido-E.taller-E.dorm,0);
  ok('embudo: otros ajustes = 0',E.otros,0);
  ok('embudo: lista de descuentos',E.descuentos.map(x=>x.c.ot).join(','),'4');
}
// ---- Prospección de servicios de mantenimiento ----
{
  const aplicar=(vehs,pl)=>{for(const {key,data} of pl.escribir){const ex=vehs[key]||{};vehs[key]={...ex,...data,serv:{...(ex.serv||{}),...(data.serv||{})},ord:{...(ex.ord||{}),...(data.ord||{})}}}};
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
  // Dos sedes con la MISMA OT (5400) para el mismo cliente: no se pisan, se marcan con el código de la otra sede
  {const z=[cab,fila('5400','2025-03-01','','P777XYZ',40000,'SERVICIO MENOR',0,'Aprobado por Cliente'),total('5400','2025-03-01','','P777XYZ',40000,'SERVICIO MENOR',500,'Aprobado por Cliente')];
   const c=[cab,fila('5400','2026-01-15','','P777XYZ',48000,'SERVICIO INTERMEDIO',0,'Aprobado por Cliente'),total('5400','2026-01-15','','P777XYZ',48000,'SERVICIO INTERMEDIO',900,'Aprobado por Cliente')];
   const xs={};aplicar(xs,L.planServicios(z,xs,{}));const p2=L.planServicios(c,xs,{origen:'caes'});aplicar(xs,p2);
   const v=Object.values(xs)[0];
   ok('dos sedes: un solo vehículo con la visita de cada sede',Object.keys(xs).length,1);
   ok('dos sedes: la OT repetida no se pisa (2 órdenes)',Object.keys(v.ord).sort().join(','),'5400,CAES-5400');
   ok('dos sedes: la otra sede cuenta como visita (última fecha)',L.visitasServ(v).join(','),'2025-03-01,2026-01-15');
   ok('dos sedes: volver a cargar la otra sede no duplica',L.planServicios(c,structuredClone(xs),{origen:'CAES'}).escribir.length,0);
   ok('dos sedes: se busca la OT sin la marca',L.buscarHistorial(xs,'5400').length,1);
   ok('dos sedes: se busca la OT con la marca',L.buscarHistorial(xs,'CAES-5400').length,1);}
  // Prospección usa solo los servicios de la propia sede
  {const d=new Date(HOY+'T12:00:00');d.setDate(d.getDate()-420);const f=d.toISOString().slice(0,10);
   const r=[cab,fila('77',f,'','P888QQQ',40000,'SERVICIO MENOR',0,'Aprobado por Cliente'),total('77',f,'','P888QQQ',40000,'SERVICIO MENOR',500,'Aprobado por Cliente')];
   const cruz={};aplicar(cruz,L.planServicios(r,cruz,{origen:'CAES'}));const prop={};aplicar(prop,L.planServicios(r,prop,{}));
   ok('prospección: cliente que solo vino a la otra sede no sale en las listas',L.prospectos(cruz,{},{},HOY).length,0);
   ok('prospección: el mismo cliente en su propia sede sí sale vencido',L.prospectos(prop,{},{},HOY).length,1);
   ok('esOtraSede distingue el prefijo',[L.esOtraSede('CAES-5400'),L.esOtraSede('5400'),L.esOtraSede('Z10-7')].join(),'true,false,true');}
  ok('mensaje: vencido incluye meses y firma',/Hace 13 meses/.test(L.mensajePros(a2,'Ricardo','Lube N Save Zona 10',[]))&&/Ricardo/.test(L.mensajePros(a2,'Ricardo','Lube N Save Zona 10',[])),true);
}
process.exit(fallos?1:0);
