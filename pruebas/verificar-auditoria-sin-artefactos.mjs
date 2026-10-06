import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { execFileSync } from "node:child_process";
const baseline=process.env.FINO_TEST_AUDIT_WALK_BASELINE;
if(baseline&&!/^[a-f0-9]{7,40}$/.test(baseline))throw Error("Se requiere hash Git.");
const file="pruebas/auditar-codigo.mjs";
const source=baseline?execFileSync("git",["show",`${baseline}:${file}`],{encoding:"utf8"}):fs.readFileSync(file,"utf8");
const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);let body;
ts.forEachChild(tree,node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==="walk")body=node.getText(tree);});
assert.ok(body);
const root=fs.mkdtempSync(path.join(process.cwd(),".tmp","audit-walk-")),generated=[];
try{
  for(const dir of ["utils","screens","pruebas","scripts","functions",".tmp",".gradle-cache",".pnpm-store",".android-user","output","pruebas/.tmp-999","node_modules"]){
    const folder=path.join(root,dir);fs.mkdirSync(folder,{recursive:true});
    const target=path.join(folder,"example.js");fs.writeFileSync(target,"export function soloEjemplo() {}\n");generated.push(target);
  }
  const scope={fs,path};vm.runInNewContext(body+"\nglobalThis.collect=walk;",scope);
  const actual=Array.from(scope.collect(root),file=>path.relative(root,file).replace(/\\/g,"/"));
  assert.deepEqual(actual.sort(),["functions/example.js","pruebas/example.js","screens/example.js","scripts/example.js","utils/example.js"].sort(),"audita fuentes reales; una caché no cuenta como uso ni consume la revisión");
  console.log("Auditor de código: fuentes propias incluidas y artefactos/cachés excluidos mediante recorrido original comprobado.");
}finally{
  for(const file of generated)fs.unlinkSync(file);
  for(const dir of ["pruebas/.tmp-999","utils","screens","pruebas","scripts","functions",".tmp",".gradle-cache",".pnpm-store",".android-user","output","node_modules"])fs.rmdirSync(path.join(root,dir));
  fs.rmdirSync(root);
}
