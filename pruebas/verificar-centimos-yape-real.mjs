import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Código original desde el aviso hasta Personal/Negocio y su formato visible.
// FINO_TEST_BASELINE=c7dd2ae3 falla: «S/ 6.5.» se convertía en 65.
const read = createSourceReader(), root = process.cwd();
const result = await build({ stdin: { contents: `
  export {parseNotification} from './utils/notificationParser';
  export {processCaptured} from './utils/autoCapture';
  export {separarLoDelNegocio} from './utils/negocioCaptura';
  export {fmt} from './utils/format';
`, sourcefile: "centimos-yape-original.ts", resolveDir: root, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
  alias: { "@": root, "@/utils/storage": path.join(root, "pruebas/stubs/negocio-workspace-storage.ts"),
    "expo-crypto": path.join(root, "pruebas/stubs/crypto.ts") },
  plugins: [{ name: "original-sources-and-icons", setup(b) {
    b.onLoad({ filter: /[\\/]utils[\\/]notificationParser\.ts$/ }, () => ({ contents: read("utils/notificationParser.ts"), loader: "ts", resolveDir: path.join(root,"utils") }));
    b.onResolve({ filter: /^@\/constants\/iconos$/ }, () => ({ path: "icons", namespace: "visual-only" }));
    b.onLoad({ filter: /.*/, namespace: "visual-only" }, () => ({ contents: "export const iconoDe=()=>()=>null;", loader: "js" }));
  } }],
});
const entry={exports:{}};
new Function("module","exports","require",result.outputFiles[0].text)(entry,entry.exports,createRequire(import.meta.url));
const {parseNotification,processCaptured,separarLoDelNegocio,fmt}=entry.exports;
const now=Date.now(), translate=key=>key;
const business={id:"synthetic",nombre:"Prueba ficticia",activo:true,destinoYapes:"negocio",modo:"simple",moneda:"PEN"};
let cases=0;
for(const [raw,expected] of [
  ["6.5.",6.5],["6.50.",6.5],["6,50.",6.5],["6.50,",6.5],
  ["6.50",6.5],["6,50",6.5],["6.5",6.5],["65",65],["650",650],
  ["0.50.",0.5],["0.05.",0.05],["1,250.50.",1250.5],["1.250,50.",1250.5],
]) for(const income of [true,false]) {
  const n={captureId:`synthetic-centimos-${cases++}`,package:"com.bcp.innovacxion.yapeapp",title:"Confirmación de Pago",
    text:income?`PERSONA FICTICIA te envió un pago por S/ ${raw} Gracias`:`Yapeaste S/ ${raw} a PERSONA FICTICIA`,postedAt:now-cases*1000};
  const parsed=parseNotification(n);assert.equal(parsed.ok,true,n.text);assert.equal(parsed.row.amount,expected,n.text);
  const capture=processCaptured([n],[],{},translate,now);
  assert.equal(capture.toAdd.length,1);assert.equal(capture.toAdd[0].amount,expected);assert.equal(capture.log[0].amount,expected);
  if(expected===6.5)assert.equal(fmt(capture.toAdd[0].amount,"S/"),"S/ 6.50");
  const personal=separarLoDelNegocio(capture.toAdd,capture.avisoDe,undefined,[]);
  assert.equal(personal.personales[0].amount,expected);assert.equal(personal.delNegocio.length,0);
  const split=separarLoDelNegocio(capture.toAdd,capture.avisoDe,business,[]);
  if(income){assert.equal(split.personales.length,0);assert.equal(split.delNegocio.length,1);assert.equal(split.delNegocio[0].monto,expected);
    if(expected===6.5)assert.equal(fmt(split.delNegocio[0].monto,"S/"),"S/ 6.50");
    const retry=separarLoDelNegocio(capture.toAdd,capture.avisoDe,business,split.delNegocio);assert.equal(retry.delNegocio.length,0);assert.equal(retry.personales.length,0);
  }else{assert.equal(split.delNegocio.length,0);assert.equal(split.personales[0].amount,expected)}
}
for(const ending of [".",",","!",";",""]){
  const parsed=parseNotification({package:"com.bcp.innovacxion.yapeapp",title:"Pago recibido",text:`Recibiste 6.50${ending}`,postedAt:now});
  assert.equal(parsed.ok,true);assert.equal(parsed.row.amount,6.5);
}
// Matriz general: distintos tamaños, todos los céntimos de 0.01 a 0.99,
// punto/coma, miles y puntuación. Los esperados vienen de céntimos enteros,
// no del mismo lector que se está comprobando.
let matrix=0;
const cents=[...Array.from({length:99},(_,i)=>i+1),101,105,150,650,6550,65050,650050,123456789,9876543210];
for(const value of cents){
  const integer=String(Math.floor(value/100)),fraction=String(value%100).padStart(2,"0"),expected=value/100;
  const grouped=separator=>integer.replace(/\B(?=(\d{3})+(?!\d))/g,separator);
  const forms=new Set([`${integer}.${fraction}`,`${integer},${fraction}`,`${grouped(",")}.${fraction}`,`${grouped(".")},${fraction}`]);
  if(fraction.endsWith("0"))forms.add(`${integer}.${fraction[0]}`);
  for(const amount of forms)for(const punctuation of ["",".",",","!",";","..."]){
    const notice={captureId:`synthetic-matrix-${matrix++}`,package:"com.bcp.innovacxion.yapeapp",title:"Pago recibido",text:`Te yapearon S/ ${amount}${punctuation} de PERSONA FICTICIA`,postedAt:now-matrix};
    const parsed=parseNotification(notice);assert.equal(parsed.ok,true,notice.text);assert.equal(parsed.row.amount,expected,notice.text);
    const capture=processCaptured([notice],[],{},translate,now);assert.equal(capture.toAdd[0].amount,expected);assert.equal(capture.log[0].amount,expected);
    assert.equal(separarLoDelNegocio(capture.toAdd,capture.avisoDe,business,[]).delNegocio[0].monto,expected);
  }
}
for(const amount of ["6..50","6.5.0","6.50,5","6.50.00","1,23,456.50","0.500","1.0000","12345678901234567890123456789012345"]){
  const notice={package:"com.bcp.innovacxion.yapeapp",title:"Pago recibido",text:`Te yapearon S/ ${amount}. Referencia 6.50`,postedAt:now};
  const parsed=parseNotification(notice);assert.equal(parsed.ok,false,notice.text);assert.equal(parsed.reason,"noAmount","una cifra ambigua no se sustituye por otra cifra del aviso");
  assert.equal(processCaptured([notice],[],{},translate,now).toAdd.length,0);
}
console.log(`${cases+5} casos iniciales + ${matrix} combinaciones y 8 montos ambiguos: lector/captura/reparto originales preservan los céntimos; ningún dato real escrito. Android/recepción real se comprueban aparte.`);
