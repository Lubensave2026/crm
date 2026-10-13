// Verifica que la app sea instalable: manifiesto, íconos con el tamaño declarado y enlaces en el <head>.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
let fallos=0;const ok=(n,v)=>{if(!v)fallos++;console.log((v?'OK  ':'FALLA')+' '+n)};
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
ok('manifest enlazado en index.html',/<link rel="manifest" href="manifest\.webmanifest">/.test(html));
ok('manifest: nombre, modo y colores',m.name==='CRM Lube N Save'&&m.display==='standalone'&&m.start_url==='./'&&m.theme_color==='#141414');
const png=f=>{const b=fs.readFileSync(path.join(root,f));return b.readUInt32BE(16)+'x'+b.readUInt32BE(20)};
for(const i of m.icons)ok(`ícono ${i.src} existe y mide ${i.sizes} (${i.purpose})`,fs.existsSync(path.join(root,i.src))&&png(i.src)===i.sizes);
ok('hay ícono de 192 y de 512',['192x192','512x512'].every(z=>m.icons.some(i=>i.sizes===z)));
ok('hay ícono maskable',m.icons.some(i=>/maskable/.test(i.purpose)));
for(const f of ['icons/apple-touch-icon.png','icons/favicon.ico','icons/favicon-48.png','icons/logo-login.png'])ok(`${f} existe y está enlazado`,fs.existsSync(path.join(root,f))&&html.includes(f));
process.exit(fallos?1:0);
