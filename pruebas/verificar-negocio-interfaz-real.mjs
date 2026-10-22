import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import { buildSync } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { handlerOriginal } from './helpers/handler-original.mjs';

const modules=new Map();
function original(entry) {
  if(modules.has(entry))return modules.get(entry);
  const built=buildSync({entryPoints:[entry],bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':process.cwd(),'@/utils/storage':path.resolve('pruebas/stubs/negocio-workspace-storage.ts')},logLevel:'silent'});
  const m={exports:{}};vm.runInNewContext(built.outputFiles[0].text,{module:m,exports:m.exports,console,Date,Math,Set,Map});modules.set(entry,m.exports);return m.exports;
}
const model=original('utils/negocioWorkspace.ts'), domain=original('utils/negocio.ts'), sync=original('utils/businessSync.ts');
const lang=original('constants/businessUI.ts');
let stored={negocios:[{id:'n',nombre:'Tienda',moneda:'PEN',categoria:'restaurante',activo:true,destinoYapes:'personal',creadoEn:1,modo:'categorias'},{id:'uber',nombre:'Uber',moneda:'PEN',categoria:'transporte',activo:true,destinoYapes:'personal',creadoEn:1,modo:'simple'}],productos:[{id:'p',negocioId:'n',nombre:'Comida',precio:3.5,activo:true}],ventas:[{id:'same',negocioId:'n',fecha:domain.ahoraDelNegocio().fecha,hora:'09:00',total:10,metodo:'efectivo',estado:'pagado',lineas:[{productoId:'p',nombre:'Comida anterior',precio:10,cantidad:1}]}],movimientos:[{id:'same',negocioId:'n',fecha:domain.ahoraDelNegocio().fecha,hora:'09:02',tipo:'ingreso',monto:7,metodo:'yape',descripcion:'Yape sin categoría',origen:'automatico',clasificacion:{estado:'pendiente',lineas:[]}},{id:'g',negocioId:'n',fecha:domain.ahoraDelNegocio().fecha,hora:'08:00',tipo:'gasto',monto:2,metodo:'efectivo',descripcion:'Insumos',origen:'manual'}]};
let writes=0,navigations=0;
const update=fn=>{const next=fn(stored);stored=sync.markBusinessChanges(stored,next,1000+writes++);refreshData();};
const data={isPremium:true,userCurrency:'PEN',userLanguage:'es',autoCaptureOn:false,monthNames:['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],t:key=>key,showToast(){},quitarProducto:id=>update(d=>({...d,productos:d.productos.filter(p=>p.id!==id)})),quitarNegocio:id=>update(d=>domain.borrarNegocio(d,id)),mandarYapesAlNegocio:(id,v)=>update(d=>({...d,negocios:d.negocios.map(n=>({...n,destinoYapes:n.id===id&&v?'negocio':'personal'}))}))};
function refreshData(){Object.assign(data,{negocios:stored.negocios,productos:stored.productos,ventas:stored.ventas,movimientosNegocio:stored.movimientos});}
for(const name of ['guardarNegocio','guardarProducto','guardarMovimientoNegocio','borrarFilasDelNegocio','vincularCobroDelNegocio'])data[name]=handlerOriginal('contexts/AppDataContext.tsx',name,{setDatosNegocio:update,borrarFilasNegocio:model.borrarFilasNegocio,vincularCobroNegocio:model.vincularCobroNegocio});
refreshData();
let slots=[],cursor=0,effects=[];
const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'Fragment'};
const hooks={...React,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},useMemo(fn){cursor++;return fn();},useEffect(fn){cursor++;effects.push(fn);}};
const rn={Platform:{OS:'android',select:values=>values.android??values.default},useWindowDimensions:()=>({width:390,height:850,fontScale:1})};
for(const name of ['Text','View','TextInput','ScrollView','TouchableOpacity','Pressable','KeyboardAvoidingView'])rn[name]=name;
rn.FlatList=props=>React.createElement('List',null,props.ListHeaderComponent,props.data.length?props.data.map((item,index)=>props.renderItem({item,index})):props.ListEmptyComponent,props.ListFooterComponent);
const uiModules=new Map();
function ui(file) {
  if(uiModules.has(file))return uiModules.get(file);
  let source=fs.readFileSync(file,'utf8');
  if(file==='screens/BusinessWorkspace.tsx'&&process.env.FINO_BUSINESS_RESULT_BASELINE){assert.match(process.env.FINO_BUSINESS_RESULT_BASELINE,/^[a-f\d]{7,40}$/);source=execFileSync('git',['show',`${process.env.FINO_BUSINESS_RESULT_BASELINE}:screens/BusinessWorkspace.tsx`],{encoding:'utf8'});}
  else if(file==='screens/BusinessWorkspace.tsx'&&process.env.FINO_BUSINESS_SETUP_BASELINE){assert.match(process.env.FINO_BUSINESS_SETUP_BASELINE,/^[a-f\d]{7,40}$/);source=execFileSync('git',['show',`${process.env.FINO_BUSINESS_SETUP_BASELINE}:screens/BusinessWorkspace.tsx`],{encoding:'utf8'});}
  else if(file==='screens/BusinessWorkspace.tsx'&&process.env.FINO_BUSINESS_UI_BASELINE){assert.match(process.env.FINO_BUSINESS_UI_BASELINE,/^[a-f\d]{7,40}$/);source=execFileSync('git',['show',`${process.env.FINO_BUSINESS_UI_BASELINE}:screens/PanelNegocio.tsx`],{encoding:'utf8'});}
  const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
  const m={exports:{}};
  const require=specifier=>{
    if(specifier==='react')return hooks;
    if(specifier==='react-native')return rn;
    if(specifier==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,bottom:0})};
    if(specifier==='lucide-react-native')return new Proxy({},{get:(_,key)=>String(key)});
    if(specifier==='@/contexts/AppDataContext')return {useAppData:()=>data};
    if(specifier==='@/utils/nav')return {irUnaVez:()=>navigations++};
    if(specifier==='@/constants/style')return {CARD_SHADOW:{}};
    if(specifier==='@/components/BackButton')return {default:props=>React.createElement('TouchableOpacity',{...props},'Volver raíz')};
    if(specifier==='@/components/AvisoSoloLectura')return {default:()=>React.createElement('Text',null,'Solo lectura')};
    if(specifier==='@/components/PrivateModal')return {default:'Modal'};
    if(specifier==='@/components/MovementDateHeader')return {default:props=>React.createElement('Text',{accessibilityRole:'header',date:props.date},props.date)};
    if(specifier.startsWith('@/components/'))return ui(specifier.slice(2)+'.tsx');
    if(specifier.startsWith('@/'))return original(specifier.slice(2)+'.ts');
    throw Error('Dependencia no adaptada: '+specifier);
  };
  vm.runInNewContext(result,{module:m,exports:m.exports,require,React,console,Date,Math,Map,Set});uiModules.set(file,m.exports);return m.exports;
}
const Screen=ui('screens/BusinessWorkspace.tsx').default;
function expand(node){if(Array.isArray(node))return node.flatMap(expand);if(node==null||typeof node==='boolean')return [];if(typeof node!=='object')return [node];if(typeof node.type==='function')return expand(node.type(node.props));return [{...node,children:expand(node.props?.children)}];}
let tree;
function render(){cursor=0;effects=[];tree=expand(Screen({negocioId:'n',onBack:()=>navigations++}));effects.forEach(fn=>fn());}
function flatten(value){return value.flatMap(n=>typeof n==='object'?[n,...flatten(n.children??[])]:[]);}
function nodes(){const all=flatten(tree),modal=all.filter(n=>n.type==='Modal').at(-1);return modal?flatten([modal]):all;}
function text(node){return (typeof node==='object'?(node.children??[]).map(text).join(''):String(node)).replace(/\s+/g,' ').trim();}
function buttons(label){return nodes().filter(n=>n.props?.onPress&&text(n)===label&&!n.props.disabled);}
function press(label){const found=buttons(label);assert.equal(found.length,1,`Botón único: ${label}; disponibles: ${nodes().filter(n=>n.props?.onPress).map(text).join('|')}`);found[0].props.onPress();render();}
function tapId(id){const n=nodes().find(n=>n.props?.testID===id);assert(n,id);n.props.onPress();render();}
function tapLabel(label){const n=nodes().find(n=>n.props?.onPress&&n.props.accessibilityLabel===label);assert(n,label);n.props.onPress();render();}
function field(label,value){const n=nodes().find(n=>n.type==='TextInput'&&n.props.accessibilityLabel===label);assert(n,label);n.props.onChangeText(value);render();}
function close(){const n=nodes().find(n=>n.props?.onPress&&n.props.accessibilityLabel==='Cerrar');assert(n);n.props.onPress();render();}
const snapshot=()=>JSON.stringify(stored);
render();
assert.equal(nodes().filter(n=>/^business-total-/.test(n.props?.testID??'')).length,2,'El panel real solo muestra dos totales, no Ventas/Ingresos separados');
const resultCard=nodes().find(n=>n.props?.testID==='business-summary-card');
assert(resultCard,'Ingresos, Gastos y Resultado comparten una sola tarjeta');
assert(String(resultCard.props.className).includes('border-slate-300'),'El contorno de la tarjeta única es visible');
assert(resultCard.children.some(n=>n.props?.testID==='business-totals')&&resultCard.children.some(n=>n.props?.testID==='business-result-divider'),'La tarjeta única contiene los dos totales y la línea interna');
assert.equal(text(nodes().find(n=>n.props?.testID==='business-result-amount')),'S/ 15','El resultado inicial es ingreso menos gasto del periodo');
assert(nodes().find(n=>n.props?.testID==='business-result-divider'),'La fila del resultado lleva su línea divisora');
assert(String(nodes().find(n=>n.props?.testID==='business-result-amount').props.className).includes('text-emerald-700'),'Un resultado positivo se muestra en verde');
const resultCheckId='result-check';
data.guardarMovimientoNegocio({id:resultCheckId,negocioId:'n',fecha:domain.ahoraDelNegocio().fecha,hora:'09:03',tipo:'gasto',monto:20,metodo:'efectivo',descripcion:'Prueba local',origen:'manual'});
render();
assert.equal(text(nodes().find(n=>n.props?.testID==='business-result-amount')),'-S/ 5','El resultado negativo se actualiza y conserva el signo');
assert(String(nodes().find(n=>n.props?.testID==='business-result-amount').props.className).includes('text-rose-700'),'Un resultado negativo se muestra en rojo');
stored={...stored,movimientos:stored.movimientos.filter(m=>m.id!==resultCheckId)};refreshData();writes=0;render();
const before=snapshot();
assert(!nodes().some(n=>text(n)==='Venta'));
const automaticRow=nodes().find(n=>n.props?.testID==='business-row-movimiento:same');
assert(automaticRow,'El movimiento automático se muestra como tarjeta');
const automaticText=text(automaticRow);
assert(automaticText.indexOf('9:02 a.m.')>=0&&automaticText.indexOf('Ingreso automático')>automaticText.indexOf('9:02 a.m.'),'La hora aparece antes del tipo de ingreso');
const incomeAmountClass=String(nodes().find(n=>n.props?.testID==='business-amount-movimiento:same').props.className);
assert(incomeAmountClass.includes('text-emerald-700')&&!incomeAmountClass.includes('bg-'),'El ingreso conserva el verde en el texto sin una tarjeta de color');
assert(String(nodes().find(n=>n.props?.testID==='business-method-movimiento:same').props.className).includes('bg-violet-50'),'Yape tiene etiqueta de método con color');
const expenseAmountClass=String(nodes().find(n=>n.props?.testID==='business-amount-movimiento:g').props.className);
assert(expenseAmountClass.includes('text-rose-700')&&!expenseAmountClass.includes('bg-'),'El gasto conserva el rojo en el texto sin una tarjeta de color');
assert(String(nodes().find(n=>n.props?.testID==='business-method-movimiento:g').props.className).includes('bg-slate-100'),'Efectivo tiene etiqueta de método con color');
tapId('business-period-fechas');assert(buttons('Ver todo').length);
const month=domain.ahoraDelNegocio().fecha.slice(0,7);
tapLabel('Fechas · Desde');tapLabel(`${month}-18`);
tapLabel('Fechas · Hasta');tapLabel(`${month}-19`);
assert(nodes().some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Desde'&&n.props.value===`${month}-18`),'El calendario Hasta no cambia Desde');
assert(nodes().some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Hasta'&&n.props.value===`${month}-19`));
const calendar=ui('components/business/BusinessCalendar.tsx').businessCalendarDays;
assert.equal(calendar('2024-02').filter(Boolean).length,29);assert.equal(calendar('2026-02').filter(Boolean).length,28);
press('Ver todo');assert.equal(writes,0);
tapId('business-period-fechas');field('Desde','2026-10-21');field('Hasta','2026-10-19');press('Ver este periodo');assert(nodes().some(n=>n.props?.accessibilityRole==='alert'));press('Ver todo');assert.equal(snapshot(),before);
tapId('business-period-hoy');tapId('business-pending');assert.equal(nodes().filter(n=>n.props?.testID?.startsWith('business-row-')).length,1);tapId('business-pending');assert.equal(nodes().filter(n=>n.props?.testID?.startsWith('business-row-')).length,3);
press('Seleccionar');tapId('business-row-movimiento:same');assert.equal(nodes().filter(n=>n.props?.testID?.startsWith('business-row-')&&n.props.accessibilityState.checked).length,1,'Seleccionar uno no selecciona la venta con el mismo ID');press('Eliminar (1)');assert.equal(snapshot(),before,'Solo confirmar modifica el libro');press('Cancelar');press('Eliminar (1)');press('Eliminar');assert.equal(stored.movimientos.some(m=>m.id==='same'),false);assert.equal(stored.ventas.length,1);assert(stored.deleted.movimientos.includes('same'));assert.equal(stored.negocios.length,2);assert.equal(text(nodes().find(n=>n.props?.testID==='business-result-amount')),'S/ 8','El resultado se recalcula al borrar un movimiento');
tapId('business-register');const categoryPicker=nodes().find(n=>n.props?.testID==='business-category-picker');assert(categoryPicker,'El acceso a categorías está junto a la indicación del registro');assert.equal(categoryPicker.props.accessibilityLabel,'Categoría','La tarjeta compacta identifica el catálogo');assert.equal(categoryPicker.props.accessibilityHint,'Toca una categoría para registrar ese importe al instante.');assert(String(categoryPicker.props.className).includes('min-h-10')&&String(categoryPicker.props.className).includes('rounded-lg'),'El acceso a categorías es una tarjeta compacta');assert(!categoryPicker.props.subtitle,'La tarjeta compacta no ocupa alto con una segunda línea');tapId('business-category-picker');const newCategoryButton=nodes().find(n=>n.props?.testID==='business-new-category');assert(newCategoryButton,'Nueva categoría debe ser un botón visible y fácil de tocar');assert(String(newCategoryButton.props.className).includes('bg-emerald-600'),'Nueva categoría debe tener color de acción');press('Volver');
press('Otra cantidad o método de pago');field('Cantidad','1.5');assert(nodes().some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Cantidad'&&n.props.value==='1.5'),'Una cantidad decimal no se convierte silenciosamente en 15');field('Cantidad','2');tapId('business-quantity-increase');assert(nodes().some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Cantidad'&&n.props.value==='3'),'La flecha suma una unidad');tapId('business-quantity-decrease');assert(nodes().some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Cantidad'&&n.props.value==='2'),'La flecha resta una unidad');field('Cantidad','50');assert(nodes().find(n=>n.props?.testID==='business-quantity-increase').props.disabled,'La flecha no supera el máximo permitido');field('Cantidad','2');press('Método de pagoEfectivo ›');press('Yape');press('Volver');press('Otra cantidad o método de pago');assert(nodes().some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Cantidad'&&n.props.value==='2'),'Volver conserva cantidad');assert(nodes().some(n=>n.props?.onPress&&text(n)==='Método de pagoYape ›'),'Volver conserva método');press('Volver');press('Ingreso sin categoríaImporte libre ›');field('Concepto','Sin guardar');field('Importe · S/','8,10');press('Gasto');field('Concepto','Otro borrador');press('Volver');assert(nodes().some(n=>n.type==='TextInput'&&n.props.value==='Sin guardar'));close();assert.equal(stored.movimientos.length,1);
tapId('business-register');press('Comida+ S/ 3.50');assert.equal(stored.movimientos.at(-1).monto,3.5);assert.equal(stored.movimientos.at(-1).tipo,'ingreso');assert.equal(stored.movimientos.at(-1).clasificacion.lineas[0].nombre,'Comida');const savedAmount=stored.movimientos.at(-1).monto;data.guardarProducto({...stored.productos[0],precio:4});render();assert.equal(stored.movimientos.at(-1).monto,savedAmount,'Cambiar precio no cambia el pasado');press('Deshacer');assert.equal(stored.movimientos.length,1);
tapId('business-picker');press('+ Crear negocio');field('Nombre','No guardar negocio');press('Volver');press('+ Crear negocio');assert(nodes().some(n=>n.type==='TextInput'&&n.props.value==='No guardar negocio'));close();assert.equal(stored.negocios.length,2);
const beforeSetup={negocios:stored.negocios,productos:stored.productos,ventas:stored.ventas,movimientos:stored.movimientos};
tapId('business-picker');press('+ Crear negocio');field('Nombre','Negocio de prueba');press('Guardar');
assert(nodes().some(n=>n.type==='Text'&&text(n)==='Configurar negocio'),'Crear un negocio abre la configuración inicial');
assert(nodes().some(n=>n.type==='TouchableOpacity'&&n.props.accessibilityRole==='switch'&&n.props.accessibilityLabel==='Registrar Yapes aquí'),'La configuración muestra el destino de Yape');
assert(nodes().some(n=>n.type==='TouchableOpacity'&&n.props.accessibilityRole==='switch'&&n.props.accessibilityLabel==='Reconocer combinaciones'),'La configuración muestra combinaciones');
tapLabel('Reconocer combinaciones');assert.equal(stored.negocios.find(n=>n.nombre==='Negocio de prueba').reconocerCombinaciones,false,'El interruptor actualiza la preferencia');
tapLabel('Registrar Yapes aquí');assert.equal(stored.negocios.find(n=>n.nombre==='Negocio de prueba').destinoYapes,'negocio','El interruptor asigna los nuevos Yapes al negocio elegido');
tapId('business-setup-categories');assert(nodes().some(n=>n.props?.testID==='business-new-category'),'La configuración lleva al catálogo de categorías');
press('+ Nueva categoría');field('Nombre','Bebida');field('Precio · S/','3,50');press('Guardar');assert(stored.productos.some(p=>p.negocioId===stored.negocios.find(n=>n.nombre==='Negocio de prueba').id&&p.nombre==='Bebida'),'La categoría queda asociada al negocio nuevo');
const testBusiness=stored.negocios.find(n=>n.nombre==='Negocio de prueba');data.quitarNegocio(testBusiness.id);stored={...stored,negocios:beforeSetup.negocios,productos:beforeSetup.productos,ventas:beforeSetup.ventas,movimientos:beforeSetup.movimientos};refreshData();close();
tapId('business-picker');press('TiendaAbrir ›');tapLabel('Opciones del negocio');assert(nodes().some(n=>n.type==='TouchableOpacity'&&n.props.accessibilityRole==='switch'&&n.props.accessibilityLabel==='Reconocer combinaciones'),'Combinaciones siguen accesibles desde Opciones');close();tapId('business-picker');press('UberAbrir ›');tapId('business-register');assert(nodes().some(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='Concepto'),'El modo simple abre el formulario sin categorías');close();
data.isPremium=false;render();assert.equal(nodes().filter(n=>n.props?.testID==='business-register').length,0);assert.equal(buttons('Seleccionar').length,0,'Solo lectura no permite borrar');tapId('business-picker');assert.equal(buttons('+ Crear negocio').length,0);close();
for(const language of ['es','en','pt'])for(const key of ['incomes','expenses','result','dates','all','pending','deleteHint','manualYape'])assert(lang.businessText(language,key).length>0);
for(const language of ['es','en','pt'])for(const key of ['setupBusiness','setupIntro','createCategories','finishSetup','categoryTapHint','quantityHint','increaseQuantity','decreaseQuantity','incomeManual','incomeAutomatic','expenseManual','expenseAutomatic'])assert(lang.businessText(language,key).length>0);
assert.equal(navigations,0,'Los formularios no requieren salir y volver a entrar');
console.log('Interfaz original real: resultado de ingresos menos gastos, colores positivo/negativo, actualización tras borrar, configuración y categorías, cantidad, movimientos, fechas/filtros, selección y Pro. React/Android e IO adaptados; sin datos de cuenta.');
