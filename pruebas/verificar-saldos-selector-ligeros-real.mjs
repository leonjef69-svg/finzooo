// Expresión original del selector + cuentas financieras reales; sin Android ni guardados.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {build} from 'esbuild';

const baseline=process.env.FINO_MONTH_BALANCES_BASELINE;
const file='components/MonthSelector.tsx';
const source=baseline?execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'}):fs.readFileSync(file,'utf8');
const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let expression;
function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='monthBalances')expression=node.initializer.arguments[0].getText(tree);
  ts.forEachChild(node,visit);
}visit(tree);assert.ok(expression);
const module={exports:{}};
const bundle=await build({stdin:{contents:`export {personalMonthlyBalances} from '@/utils/personalMonthlyBalances';
  export {availablePersonalBalance,totalsForMonth} from '@/utils/finances';
  export {saldoAnteriorDe} from '@/utils/saldoAnterior';export {presupuestoDelMes} from '@/utils/presupuestoMensual';
  export {saldoLibre,totalApartado} from '@/utils/ahorro';`,resolveDir:process.cwd(),loader:'ts'},
  bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':process.cwd()},logLevel:'silent'});
new Function('module','exports',bundle.outputFiles[0].text)(module,module.exports);
const api=module.exports;
const compiled=ts.transpileModule(`(${expression})`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function calculate({months,budgets,transactions,carryoverCleared=[],goals=[],open=true}){
  const dependencies={...api,months,budgets,transactions,carryoverCleared,goals,open};
  return new Function(...Object.keys(dependencies),`return ${compiled.trim().replace(/;$/,'')}`)(...Object.values(dependencies))();
}
function expected(fixture){
  const reserved=api.totalApartado(fixture.goals??[]);
  return Object.fromEntries(fixture.months.map(key=>[key,api.saldoLibre(api.availablePersonalBalance({
    budget:api.presupuestoDelMes(fixture.budgets,key),
    prevBalance:api.saldoAnteriorDe(key,fixture.budgets,fixture.transactions,fixture.carryoverCleared??[]),
    ...api.totalsForMonth(fixture.transactions,key),
  }),reserved)]));
}
function same(fixture){
  const before=JSON.stringify(fixture);
  assert.deepEqual(calculate(fixture),expected(fixture));
  assert.equal(JSON.stringify(fixture),before,'Mostrar los meses no cambia sus fuentes');
}
const key=i=>`${2017+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;
const months=Array.from({length:120},(_,i)=>key(i));
const transactions=Array.from({length:10_000},(_,i)=>({id:i+1,date:`${months[i%120]}-${String(i%28+1).padStart(2,'0')}`,
  type:i%3===0?'income':'expense',amount:(i%173+1)/1000,
  ...(i%11===0?{internalTransfer:'goal'}:i%7===0?{internalTransfer:i%2?'family':'box'}:{}),
  ...(i%13===0?{hiddenFromHistory:true}:{}),
}));
const budgets=Object.fromEntries(months.filter((_,i)=>i%3===0).map((month,i)=>[month,i%5?100.123:0]));
const fixture={months:[...months].reverse(),transactions,budgets,carryoverCleared:[key(0),key(45),key(87)],goals:[{saved:25.123},{saved:3.001}]};
same(fixture);
same({months:['2026-02','2026-04','2026-06'],budgets:{'2026-01':100,'2026-03':20,'invalid':999},
  transactions:[{date:'2026-02-10',type:'expense',amount:10},{date:'2026-04-10',type:'income',amount:7}],
  carryoverCleared:['2026-03','2026-06'],goals:[{saved:2}]});
same({months:['2026-01','2026-01','2026-04','2025-12'],budgets:{'2025-01':20,'2026-01':3,'bad':10_000},
  transactions:[{date:'2024-02-03',type:'income',amount:10.123},{date:'2026-02-03',type:'expense',amount:4.008,internalTransfer:'family'},
    {date:'2026-03-03',type:'income',amount:1.004,internalTransfer:'family'},{date:'2027-02-03',type:'income',amount:99}],
  carryoverCleared:['2025-03','2025-03'],goals:[]});
for(let seed=1;seed<=25;seed++){
  same({months:months.slice(0,24).filter((_,i)=>i%seed!==1).reverse(),
    budgets:Object.fromEntries(months.slice(0,24).filter((_,i)=>i%3===seed%3).map((key,i)=>[key,seed*i+.123])),
    transactions:transactions.slice(seed*7,seed*7+100).map((row,i)=>({...row,amount:(seed*i%357+.5)/1000})),
    carryoverCleared:months.slice(0,24).filter((_,i)=>i%7===seed%7),goals:[{saved:seed/1000}]});
}
let reads=0;
const observed=transactions.map(row=>new Proxy(row,{get(target,name){if(name==='date')reads++;return target[name]}}));
const input={...fixture,transactions:observed};
expected(input);const beforeReads=reads;reads=0;
calculate(input);const afterReads=reads;
assert.ok(afterReads<=transactions.length*3,`El selector debe leer el historial una vez y los grupos una vez: ${afterReads}`);
assert.ok(beforeReads>afterReads*50,`Debe eliminar los recorridos por mes: ${beforeReads} → ${afterReads}`);
reads=0;assert.deepEqual(calculate({...input,open:false}),{});assert.equal(reads,0,'Cerrado no recorre movimientos');
console.log(`28 escenarios de saldos idénticos; 120 meses/10.000 movimientos: ${beforeReads} → ${afterReads} lecturas de fecha. No es medición de FPS.`);
