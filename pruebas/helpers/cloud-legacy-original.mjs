import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { recordOriginOriginal } from './record-origin-original.mjs';
const require=createRequire(import.meta.url);
// Adaptador de la dependencia nueva para las suites antiguas: ejecuta su
// implementación original actual, no una copia permisiva de su algoritmo.
export function cloudLegacyOriginal(records=recordOriginOriginal()) {
 const module={exports:{}};
 vm.runInNewContext(ts.transpile(fs.readFileSync('utils/cloudLegacyTransfers.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}),{
  module,exports:module.exports,require:name=>{
   if(name==='@/utils/recordMerge')return records;
   if(name==='@/functions/src/private-box-money-shared')return require('../../functions/src/private-box-money-shared.js');
   throw Error('Dependencia sin adaptar: '+name);
  },
 });return module.exports;
}
