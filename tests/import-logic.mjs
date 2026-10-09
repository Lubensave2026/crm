// Prueba de aceptación de la lógica de importación con el Excel real (sin Firebase).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import XLSX from 'xlsx';
const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'..','index.html'),'utf8');
const bloque=html.split('/*@PURA-INICIO')[1].split('/*@PURA-FIN*/')[0].replace(/^[^\n]*\n/,'');
const HOY='2026-10-09';
const L=new Function('TODAY',bloque+';return {planImport,montoCaso,moCaso,abierto,computeAgenda,Q}')(HOY);
const xlsx=fs.readdirSync(path.join(dir,'..','referencia')).find(f=>/Reporte de Actividad.*\.xlsx$/.test(f));
const wb=XLSX.read(fs.readFileSync(path.join(dir,'..','referencia',xlsx)),{type:'buffer',cellDates:true});
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
process.exit(fallos?1:0);
