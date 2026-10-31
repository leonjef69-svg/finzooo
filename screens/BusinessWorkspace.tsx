import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, MoreHorizontal } from "lucide-react-native";
import AvisoSoloLectura from "@/components/AvisoSoloLectura";
import BackButton from "@/components/BackButton";
import MovementDateHeader from "@/components/MovementDateHeader";
import Toggle from "@/components/Toggle";
import { BusinessButton, BusinessChoice, BusinessField, BusinessQuantityStepper, BusinessSheet } from "@/components/business/BusinessPrimitives";
import BusinessReports from "@/components/business/BusinessReports";
import BusinessCalendar from "@/components/business/BusinessCalendar";
import { useAppData } from "@/contexts/AppDataContext";
import { businessText, type BusinessText } from "@/constants/businessUI";
import { currencySymbolFor } from "@/constants/currencies";
import { fmt } from "@/utils/format";
import { isSafeMoneyAmount, parseAmountInput, sanitizeAmountInput } from "@/utils/amount";
import { ahoraDelNegocio, crearMovimientoNegocio, crearNegocio, crearProducto, productoRepetido, type LineaDeVenta, type MetodoDeVenta, type Negocio } from "@/utils/negocio";
import { BUSINESS_FILTER, importeCategoria, coincidenciasNegocio, fechaNegocioValida, filasDelNegocio, filtrarNegocio, modoDelNegocio, periodoNegocio, totalesWorkspace, type BusinessFilter, type BusinessPeriod, type BusinessRow } from "@/utils/negocioWorkspace";
import { horaVisible } from "@/utils/negocioTotales";
import { startsMovementDay } from "@/utils/movementDates";
import { hayRegistroAutomatico } from "@/utils/dondeHayYape";
import { irUnaVez } from "@/utils/nav";

type Kind="register"|"entry"|"priced"|"categories"|"category"|"businesses"|"business"|"setup"|"options"|"dates"|"filters"|"method"|"filter-method"|"filter-category"|"product"|"detail"|"confirm-delete"|"confirm-business"|"confirm-yape"|"link"|"confirm-link"|"reports"|"calendar";
type Panel={kind:Kind;dateTarget?:"from"|"until";id?:string;tipo?:"ingreso"|"gasto";name?:string;amount?:string;quantity?:string;method?:MetodoDeVenta;productId?:string;mode?:"categorias"|"simple";from?:string;until?:string;filter?:BusinessFilter;keys?:string[];manualKey?:string};
const METHODS: MetodoDeVenta[]=["efectivo","yape","plin","transferencia","tarjeta","otro"];
const METHOD_TONE:Record<MetodoDeVenta,{background:string;foreground:string}>={
  efectivo:{background:"bg-slate-100 dark:bg-slate-700",foreground:"text-slate-700 dark:text-slate-200"},
  yape:{background:"bg-violet-50 dark:bg-violet-950/60",foreground:"text-violet-700 dark:text-violet-300"},
  plin:{background:"bg-sky-50 dark:bg-sky-950/60",foreground:"text-sky-700 dark:text-sky-300"},
  transferencia:{background:"bg-blue-50 dark:bg-blue-950/60",foreground:"text-blue-700 dark:text-blue-300"},
  tarjeta:{background:"bg-indigo-50 dark:bg-indigo-950/60",foreground:"text-indigo-700 dark:text-indigo-300"},
  otro:{background:"bg-amber-50 dark:bg-amber-950/60",foreground:"text-amber-800 dark:text-amber-200"},
};
const keyOf=(p:Panel)=>`${p.kind}:${p.id??""}:${p.tipo??""}:${p.dateTarget??""}`;

/** Un solo panel real: nunca copia datos de la maqueta ni mueve dinero a Personal. */
export default function BusinessWorkspace({negocioId,onBack,soloLectura=false,initialPanel,initialType="ingreso"}:{negocioId?:string;onBack:()=>void;soloLectura?:boolean;initialPanel?:"register"|"entry"|"categories";initialType?:"ingreso"|"gasto"}) {
  const app=useAppData();
  const {negocios,productos,ventas,movimientosNegocio,userCurrency,userLanguage,isPremium,autoCaptureOn,guardarNegocio,guardarProducto,guardarMovimientoNegocio,quitarProducto,quitarNegocio,mandarYapesAlNegocio,borrarFilasDelNegocio,vincularCobroDelNegocio,showToast}=app;
  const insets=useSafeAreaInsets(), {width,fontScale}=useWindowDimensions();
  const copy=(key:BusinessText,values?:Record<string,string|number>)=>businessText(userLanguage,key,values);
  const [activeId,setActiveId]=useState(negocioId ?? negocios.find(n=>n.activo&&n.destinoYapes==="negocio")?.id ?? negocios[0]?.id ?? "");
  const negocio=negocios.find(n=>n.id===activeId);
  const currency=negocio?.moneda ?? userCurrency;
  const dinero=(value:number)=>fmt(value,currencySymbolFor(currency));
  const canWrite=!soloLectura&&isPremium;
  const mios=useMemo(()=>productos.filter(p=>p.negocioId===activeId),[productos,activeId]);
  const activos=useMemo(()=>mios.filter(p=>p.activo),[mios]);
  const mode=negocio ? modoDelNegocio(negocio,productos) : "categorias";
  const [period,setPeriod]=useState<BusinessPeriod>("hoy");
  const hoy=ahoraDelNegocio().fecha;
  const [from,setFrom]=useState(hoy),[until,setUntil]=useState(hoy);
  const [filters,setFilters]=useState<BusinessFilter>({...BUSINESS_FILTER});
  const [searchOpen,setSearchOpen]=useState(false),[selecting,setSelecting]=useState(false),[selectedKeys,setSelectedKeys]=useState<string[]>([]);
  const allRows=useMemo(()=>filasDelNegocio(activeId,{ventas,movimientos:movimientosNegocio},mode==="categorias"),[activeId,ventas,movimientosNegocio,mode]);
  const periodRows=useMemo(()=>periodoNegocio(allRows,period,hoy,from,until),[allRows,period,hoy,from,until]);
  const rows=useMemo(()=>filtrarNegocio(periodRows,filters),[periodRows,filters]);
  const totals=useMemo(()=>totalesWorkspace(periodRows),[periodRows]);
  const result=totals.ingresos-totals.gastos;
  const pending=periodRows.filter(r=>r.pendiente).length;
  const visibleKeys=useMemo(()=>new Set(rows.map(r=>r.key)),[rows]);
  const selected=useMemo(()=>selectedKeys.filter(key=>visibleKeys.has(key)),[selectedKeys,visibleKeys]);
  const selectedSet=useMemo(()=>new Set(selected),[selected]);
  const [panels,setPanels]=useState<Panel[]>(initialPanel?[{kind:initialPanel,tipo:initialType,name:"",amount:"",method:"efectivo"}]:[]),[error,setError]=useState("");
  const panel=panels.at(-1);
  useEffect(()=>{busy.current=false;},[panels]);
  const [saving,setSaving]=useState(false);
  const cache=useRef(new Map<string,Panel>()), busy=useRef(false);
  const [undo,setUndo]=useState<{id:string;businessId:string}|null>(null);
  const recibeYapes=negocio?.activo===true&&negocio.destinoYapes==="negocio";
  const otroRecibe=negocios.find(n=>n.id!==activeId&&n.activo&&n.destinoYapes==="negocio");
  function close() { if(busy.current)return;setPanels([]);cache.current.clear();setError(""); }
  function open(next:Panel) {
    if(busy.current)return;busy.current=false;setError("");
    if(panel) cache.current.set(keyOf(panel),panel);
    setPanels(previous=>{
      const existing=previous.findIndex(p=>keyOf(p)===keyOf(next));
      return existing>=0?previous.slice(0,existing+1):[...previous,cache.current.get(keyOf(next))??next];
    });
  }
  function update(changes:Partial<Panel>) { setError("");setPanels(previous=>previous.map((p,i)=>i===previous.length-1?{...p,...changes}:p)); }
  function back() { if(busy.current)return;if(panel)cache.current.set(keyOf(panel),panel);setError("");if(panels.length>1)setPanels(p=>p.slice(0,-1));else close(); }
  async function commit(action:()=>Promise<boolean>,message=copy("saved"),afterClose?:()=>void) {
    if(!canWrite||busy.current)return;
    busy.current=true;setSaving(true);
    try { if (!await action()) { busy.current=false;setError(app.t("toast.localSaveFailed"));return; } busy.current=false;setSelecting(false);setSelectedKeys([]);showToast(message);if(afterClose)afterClose();else close(); }
    catch {busy.current=false;setError(app.t("toast.localSaveFailed"));}
    finally {setSaving(false);}
  }
  function changeFilter(next:BusinessFilter) {setFilters(next);setSelectedKeys([]);}
  function choosePeriod(value:BusinessPeriod) {setPeriod(value);setSelectedKeys([]);close();}
  function chooseBusiness(id:string) {setActiveId(id);changeFilter({...BUSINESS_FILTER});setSelecting(false);setUndo(null);setPeriod("hoy");close();}
  function entry(tipo:"ingreso"|"gasto") {open({kind:"entry",tipo,name:"",amount:"",method:"efectivo"});}
  function register() {open(mode==="categorias"?{kind:"register"}:{kind:"entry",tipo:"ingreso",name:"",amount:"",method:"efectivo"});}
  function newBusiness(n?:Negocio) {open({kind:"business",id:n?.id,name:n?.nombre??"",mode:n?modoDelNegocio(n,productos):"categorias"});}
  function editCategory(id?:string) {const p=mios.find(c=>c.id===id);open({kind:"category",id,name:p?.nombre??"",amount:p?String(p.precio):""});}
  function record(monto:number,description:string,tipo:"ingreso"|"gasto",method:MetodoDeVenta,lineas?:LineaDeVenta[]) {
    if(!negocio)return;
    const {fecha,hora}=ahoraDelNegocio();
    const row=crearMovimientoNegocio({negocioId:negocio.id,tipo,monto,descripcion:description,metodo:method,fecha,hora,origen:"manual",...(lineas?{clasificacion:{estado:"confirmada" as const,lineas}}:{})});
    commit(async()=>{if(!await guardarMovimientoNegocio(row))return false;setUndo({id:row.id,businessId:negocio.id});setPeriod("hoy");changeFilter({...BUSINESS_FILTER});return true;});
  }
  function saveEntry() {
    if(!panel)return;
    const category=activos.find(p=>p.id===panel.productId), qty=Number(panel.quantity??"1");
    const amount=panel.kind==="priced"&&category?importeCategoria(category.precio,qty):parseAmountInput(panel.amount??"",currency);
    const name=panel.kind==="priced"?category?.nombre??"":panel.name?.trim()??"";
    if(panel.kind==="priced"&&(!category||!Number.isInteger(qty)||qty<1||qty>50))return setError(copy("badQuantity"));
    if(!name||!isSafeMoneyAmount(amount)||amount<=0)return setError(copy("invalid"));
    record(amount,name,panel.tipo??"ingreso",panel.method??"efectivo",panel.kind==="priced"&&category?[{productoId:category.id,nombre:category.nombre,precio:category.precio,cantidad:qty}]:undefined);
  }
  async function saveCategory() {
    if(!negocio||!panel)return;
    const name=panel.name?.trim()??"",price=parseAmountInput(panel.amount??"",currency);
    if(!name||!Number.isFinite(price)||price<=0)return setError(copy("invalid"));
    if(productoRepetido(productos,negocio.id,name,panel.id))return setError(copy("duplicate"));
    const old=mios.find(p=>p.id===panel.id);
    if(panel.id&&!old)return setError(copy("invalid"));
    if(!canWrite||busy.current)return;
    busy.current=true;setSaving(true);const saved=await guardarProducto(old?{...old,nombre:name,precio:price}:crearProducto(negocio.id,name,price)).catch(()=>false);
    setSaving(false);busy.current=false;
    if(!saved){busy.current=false;setError(app.t("toast.localSaveFailed"));return;}
    cache.current.delete(keyOf(panel));setError("");setPanels(previous=>previous.length>1?previous.slice(0,-1):[{kind:"categories"}]);showToast(copy("saved"));
  }
  function saveBusiness() {
    if(!panel)return;
    const name=panel.name?.trim()??"";
    if(!name)return setError(copy("invalid"));
    if(negocios.some(n=>n.id!==panel.id&&n.nombre.toLocaleLowerCase()===name.toLocaleLowerCase()))return setError(copy("duplicate"));
    const old=negocios.find(n=>n.id===panel.id);
    if(panel.id&&!old)return setError(copy("invalid"));
    const next={...(old??crearNegocio({nombre:name,categoria:"otro",moneda:userCurrency})),nombre:name,modo:panel.mode??"categorias"};
    const isNew=!old;
    commit(()=>guardarNegocio(next),copy("saved"),()=>{
      if(!isNew){chooseBusiness(next.id);return;}
      setActiveId(next.id);changeFilter({...BUSINESS_FILTER});setSelecting(false);setSelectedKeys([]);setUndo(null);setPeriod("hoy");
      cache.current.clear();setError("");setPanels([{kind:"setup"}]);
    });
  }
  function setYapes(v:boolean) {
    if (soloLectura && v) return;
    if(v&&!canWrite)return;
    if(v&&otroRecibe)return open({kind:"confirm-yape"});
    mandarYapesAlNegocio(activeId,v);
  }
  function classify(row:BusinessRow,lineas:LineaDeVenta[]) {
    const original=movimientosNegocio.find(m=>m.id===row.id&&m.negocioId===activeId);
    if(!original)return;
    commit(()=>guardarMovimientoNegocio({...original,clasificacion:{estado:"confirmada",lineas}}));
  }
  const detail=panel?.id?allRows.find(r=>r.key===panel.id):undefined;
  const candidates=detail?.automatico&&!detail.vinculoManual?allRows.filter(r=>!r.automatico&&r.tipo==="ingreso"&&r.metodo==="yape"&&Math.round(r.monto*100)===Math.round(detail.monto*100)):[];
  const vertical=Math.max(dinero(totals.ingresos).length,dinero(totals.gastos).length)*12>(width-66)/2/fontScale;
  const hasFilters=JSON.stringify(filters)!==JSON.stringify(BUSINESS_FILTER);
  function methodName(method: string) {return method==="efectivo"?copy("cash"):method==="transferencia"?copy("transfer"):method==="tarjeta"?copy("card"):method==="otro"?copy("other"):method==="yape"?"Yape":method==="plin"?"Plin":method;}
  function methodPicker(kind:Kind="method") {open({kind});}
  const typeTabs=(tipo:"ingreso"|"gasto")=><View className="flex-row gap-2">{(["ingreso","gasto"] as const).map(type=><View key={type} className="flex-1"><BusinessButton secondary={tipo!==type} label={copy(type==="ingreso"?"income":"expense")} onPress={()=>type==="ingreso"&&mode==="categorias"?open({kind:"register"}):entry(type)}/></View>)}</View>;

  function sheetTitle():string {
    if(!panel)return "";
    const titles:Partial<Record<Kind,BusinessText>>={register:"registerTitle",entry:panel.tipo==="gasto"?"expense":"income",priced:"income",categories:"categories",category:panel.id?"edit":"newCategory",businesses:"businesses",business:panel.id?"editBusiness":"newBusiness",setup:"setupBusiness",options:"options",dates:"dates",filters:"filters",method:"method","filter-method":"method","filter-category":"category",product:"category",detail:detail?.pendiente?"classify":"detail","confirm-delete":"delete","confirm-business":"deleteBusiness","confirm-yape":"yape",link:"reviewDuplicate","confirm-link":"link",reports:"reports",calendar:"dates"};
    return copy(titles[panel.kind]??"title");
  }
  function sheetBody() {
    if(!panel)return null;
    if(!canWrite && !["businesses","detail","options","dates","filters","method","filter-method","filter-category","reports","calendar"].includes(panel.kind)) return <AvisoSoloLectura/>;
    const filter=panel.filter??filters;
    const chooseFilter=(changes:Partial<BusinessFilter>)=>update({filter:{...filter,...changes}});
    if(panel.kind==="register")return <>{typeTabs("ingreso")}<View className="flex-row items-center gap-2"><Text className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">{copy("cashHint")}</Text><TouchableOpacity testID="business-category-picker" accessibilityRole="button" accessibilityLabel={copy("category")} accessibilityHint={copy("categoryTapHint")} onPress={()=>open({kind:"categories"})} className="min-h-10 shrink-0 flex-row items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 dark:border-emerald-900 dark:bg-emerald-950/50"><Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">{copy("category")}</Text><Text className="text-sm font-bold text-emerald-700 dark:text-emerald-300">›</Text></TouchableOpacity></View>{activos.map(p=><BusinessChoice key={p.id} label={p.nombre} detail={`+ ${dinero(p.precio)}`} onPress={()=>record(p.precio,p.nombre,"ingreso","efectivo",[{productoId:p.id,nombre:p.nombre,precio:p.precio,cantidad:1}])}/>)}<BusinessButton testID="business-new-category" label={`+ ${copy("newCategory")}`} onPress={()=>editCategory()}/>{activos.length?<BusinessButton secondary label={copy("otherAmount")} onPress={()=>open({kind:"priced",productId:activos[0].id,quantity:"1",method:"efectivo"})}/>:null}<BusinessChoice label={copy("uncategorized")} detail={`${copy("freeAmount")} ›`} onPress={()=>entry("ingreso")}/></>;
    if(panel.kind==="entry"||panel.kind==="priced") {
      const p=activos.find(p=>p.id===panel.productId), qty=Number(panel.quantity??"1");
      return <>{typeTabs(panel.tipo??"ingreso")}{panel.kind==="priced"?<><BusinessChoice label={copy("category")} detail={`${p?.nombre??copy("category")} ›`} onPress={()=>open({kind:"product"})}/><BusinessQuantityStepper label={copy("quantity")} value={panel.quantity??"1"} onChange={quantity=>update({quantity})} hint={copy("quantityHint",{min:1,max:50})} decreaseLabel={copy("decreaseQuantity")} increaseLabel={copy("increaseQuantity")}/><Text className="text-2xl font-bold text-slate-900 dark:text-slate-100">{dinero(p&&Number.isInteger(qty)&&qty>0?importeCategoria(p.precio,qty):0)}</Text></>:<><BusinessField label={copy("concept")} value={panel.name??""} onChange={name=>update({name})}/><BusinessField label={`${copy("amount")} · ${currencySymbolFor(currency)}`} value={panel.amount??""} onChange={amount=>update({amount:sanitizeAmountInput(amount,currency)})} amount maxLength={20}/></>}<BusinessChoice label={copy("method")} detail={`${methodName(panel.method??"efectivo")} ›`} onPress={()=>methodPicker()}/>{panel.method==="yape"?<Text className="text-xs text-amber-800 dark:text-amber-200">{copy("manualYape")}</Text>:null}<BusinessButton label={`${copy("save")} ${copy(panel.tipo==="gasto"?"expense":"income").toLocaleLowerCase()}`} onPress={saveEntry}/></>;
    }
    if(panel.kind==="product"||panel.kind==="method"||panel.kind==="filter-method"||panel.kind==="filter-category") {
      const parent=panels.at(-2);
      const choose=(changes:Partial<Panel>)=>{setPanels(previous=>previous.slice(0,-1).map((p,i)=>i===previous.length-2?{...p,...changes}:p));setError("");};
      if(panel.kind==="product")return <>{activos.map(p=><BusinessChoice key={p.id} label={p.nombre} detail={dinero(p.precio)} selected={parent?.productId===p.id} onPress={()=>choose({productId:p.id})}/>)}</>;
      if(panel.kind==="filter-category")return <>{[{id:"todas",nombre:copy("allCategories")},...mios].map(p=><BusinessChoice key={p.id} label={p.nombre} selected={parent?.filter?.categoria===p.id} onPress={()=>choose({filter:{...(parent?.filter??filters),categoria:p.id}})}/>)}</>;
      return <>{panel.kind==="filter-method"?<BusinessChoice label={copy("allTypes")} selected={(parent?.filter?.metodo??"todos")==="todos"} onPress={()=>choose({filter:{...(parent?.filter??filters),metodo:"todos"}})}/>:null}{METHODS.filter(m=>(m!=="yape"||hayRegistroAutomatico(userCurrency))&&(m!=="plin"||app.userCountry==="PE")).map(m=><BusinessChoice key={m} label={methodName(m)} selected={panel.kind==="method"?parent?.method===m:parent?.filter?.metodo===m} onPress={()=>choose(panel.kind==="method"?{method:m}:{filter:{...(parent?.filter??filters),metodo:m}})}/>)}</>;
    }
    if(panel.kind==="categories")return <>{mios.map(p=><BusinessChoice key={p.id} label={`${p.nombre}${p.activo?"":` · ${copy("inactive")}`}`} detail={`${dinero(p.precio)} · ${copy("edit")} ›`} onPress={()=>editCategory(p.id)}/>)}<BusinessButton testID="business-new-category" label={`+ ${copy("newCategory")}`} onPress={()=>editCategory()}/></>;
    if(panel.kind==="category") {
      const old=mios.find(p=>p.id===panel.id);
      return <><BusinessField label={copy("name")} value={panel.name??""} onChange={name=>update({name})} maxLength={30}/><BusinessField label={`${copy("price")} · ${currencySymbolFor(currency)}`} amount value={panel.amount??""} onChange={amount=>update({amount:sanitizeAmountInput(amount,currency)})} maxLength={20}/><Text className="text-xs text-slate-500 dark:text-slate-300">{copy("historical")}</Text>{old?<View className="flex-row items-center justify-between"><Text className="text-sm text-slate-700 dark:text-slate-200">{copy("active")}</Text><Toggle label={copy("active")} disabled={!canWrite} on={old.activo} onChange={value=>canWrite&&guardarProducto({...old,activo:value})}/></View>:null}<BusinessButton label={copy("save")} onPress={saveCategory}/>{old?<BusinessButton danger label={copy("delete")} onPress={()=>open({kind:"confirm-delete",id:old.id,keys:[]})}/>:null}</>;
    }
    if(panel.kind==="businesses")return <>{negocios.map(n=><BusinessChoice key={n.id} label={n.nombre} detail={n.id===activeId?`${copy("current")} ✓`:`${copy("open")} ›`} selected={n.id===activeId} onPress={()=>chooseBusiness(n.id)}/>)}{canWrite?<BusinessButton label={`+ ${copy("createBusiness")}`} onPress={()=>newBusiness()}/>:null}</>;
    if(panel.kind==="business")return <><BusinessField label={copy("name")} value={panel.name??""} onChange={name=>update({name})} maxLength={30}/><Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">{copy("mode")}</Text>{(["categorias","simple"] as const).map(value=><BusinessChoice key={value} label={copy(value==="categorias"?"categoriesMode":"simpleMode")} selected={panel.mode===value} onPress={()=>update({mode:value})}/>)}<BusinessButton label={copy("save")} onPress={saveBusiness}/></>;
    if(panel.kind==="setup")return <><Text className="text-sm text-slate-600 dark:text-slate-300">{copy("setupIntro")}</Text>{hayRegistroAutomatico(userCurrency)?<><View className="flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-noche-borde"><View className="min-w-0 flex-1 gap-1"><Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy("yape")}</Text><Text className="text-xs text-slate-500 dark:text-slate-300">{copy(recibeYapes?(autoCaptureOn?"yapeOn":"yapeSetup"):"yapeOff")}</Text></View><Toggle label={copy("yape")} disabled={!canWrite} on={recibeYapes} onChange={setYapes}/></View>{recibeYapes&&!autoCaptureOn&&canWrite?<BusinessButton secondary label={copy("setup")} onPress={()=>irUnaVez("/auto-capture")}/>:null}</>:null}{mode==="categorias"?<><View className="flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-noche-borde"><View className="min-w-0 flex-1 gap-1"><Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy("combinations")}</Text><Text className="text-xs text-slate-500 dark:text-slate-300">{copy("combinationsHint")}</Text></View><Toggle label={copy("combinations")} disabled={!canWrite} on={negocio?.reconocerCombinaciones!==false} onChange={value=>negocio&&canWrite&&guardarNegocio({...negocio,reconocerCombinaciones:value})}/></View><BusinessButton testID="business-setup-categories" label={`+ ${copy("createCategories")}`} onPress={()=>open({kind:"categories"})}/></>:null}<BusinessButton secondary testID="business-setup-finish" label={copy("finishSetup")} onPress={close}/></>;
    if(panel.kind==="options")return <>{canWrite&&negocio?<><BusinessChoice label={copy("editBusiness")} onPress={()=>newBusiness(negocio)}/>{mode==="categorias"?<><View className="flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-noche-borde"><View className="min-w-0 flex-1 gap-1"><Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy("combinations")}</Text><Text className="text-xs text-slate-500 dark:text-slate-300">{copy("combinationsHint")}</Text></View><Toggle label={copy("combinations")} disabled={!canWrite} on={negocio.reconocerCombinaciones!==false} onChange={value=>canWrite&&guardarNegocio({...negocio,reconocerCombinaciones:value})}/></View><BusinessChoice label={copy("categories")} onPress={()=>open({kind:"categories"})}/></>:null}<BusinessChoice label={copy(negocio.activo?"pause":"resume")} onPress={()=>commit(()=>guardarNegocio({...negocio,activo:!negocio.activo}))}/></>:null}<BusinessChoice label={copy("businesses")} onPress={()=>open({kind:"businesses"})}/><BusinessChoice label={copy("reports")} onPress={()=>open({kind:"reports"})}/>{canWrite?<BusinessButton danger label={copy("deleteBusiness")} onPress={()=>open({kind:"confirm-business"})}/>:null}</>;
    if(panel.kind==="reports")return <BusinessReports negocioId={activeId}/>;
    if(panel.kind==="calendar") {const parent=panels.at(-2),target=panel.dateTarget??"from";return <BusinessCalendar value={parent?.[target]??hoy} language={userLanguage} months={app.monthNames} onChange={value=>setPanels(previous=>previous.slice(0,-1).map((p,i)=>i===previous.length-2?{...p,[target]:value}:p))}/>;}
    if(panel.kind==="dates")return <><BusinessField label={copy("from")} calendarLabel={`${copy("dates")} · ${copy("from")}`} onCalendar={()=>open({kind:"calendar",dateTarget:"from"})} value={panel.from??from} onChange={value=>update({from:value})} hint="AAAA-MM-DD" maxLength={10}/><BusinessField label={copy("until")} calendarLabel={`${copy("dates")} · ${copy("until")}`} onCalendar={()=>open({kind:"calendar",dateTarget:"until"})} value={panel.until??until} onChange={value=>update({until:value})} hint="AAAA-MM-DD" maxLength={10}/><Text className="text-xs text-slate-500 dark:text-slate-300">{copy("dateHint")}</Text><BusinessButton label={copy("viewRange")} onPress={()=>{const a=panel.from??from,b=panel.until??until;if(!fechaNegocioValida(a)||!fechaNegocioValida(b)||a>b)return setError(copy("badDate"));setFrom(a);setUntil(b);choosePeriod("rango");}}/><BusinessButton secondary label={copy("all")} onPress={()=>choosePeriod("todo")}/></>;
    if(panel.kind==="filters")return <><View className="flex-row gap-2">{(["todos","ingreso","gasto"] as const).map(value=><View className="flex-1" key={value}><BusinessButton secondary={filter.tipo!==value} label={copy(value==="todos"?"allTypes":value==="ingreso"?"incomes":"expenses")} onPress={()=>chooseFilter({tipo:value})}/></View>)}</View><Text className="text-xs font-bold text-slate-600 dark:text-slate-300">{copy("origin")}</Text>{(["todos","manual","automatico"] as const).map(value=><BusinessChoice key={value} label={copy(value==="todos"?"allSources":value==="manual"?"manual":"automatic")} selected={filter.origen===value} onPress={()=>chooseFilter({origen:value})}/>)}<BusinessChoice label={copy("method")} detail={filter.metodo==="todos"?copy("allTypes"):methodName(filter.metodo)} onPress={()=>methodPicker("filter-method")}/>{mode==="categorias"?<><BusinessChoice label={copy("category")} detail={mios.find(p=>p.id===filter.categoria)?.nombre??copy("allCategories")} onPress={()=>open({kind:"filter-category"})}/><View className="flex-row items-center justify-between gap-2"><Text className="min-w-0 flex-1 text-xs text-slate-700 dark:text-slate-200">{copy("onlyPending")}</Text><Toggle label={copy("onlyPending")} on={filter.pendientes} onChange={value=>chooseFilter({pendientes:value})}/></View></>:null}<BusinessButton label={copy("apply")} onPress={()=>{changeFilter(filter);close();}}/><BusinessButton secondary label={copy("clear")} onPress={()=>{changeFilter({...BUSINESS_FILTER});close();}}/></>;
    if(panel.kind==="detail"&&detail) {
      const match=coincidenciasNegocio(detail.monto,activos,negocio?.reconocerCombinaciones!==false);
      return <><Text className={`text-3xl font-extrabold ${detail.tipo==="gasto"?"text-rose-600 dark:text-rose-300":"text-emerald-700 dark:text-emerald-300"}`}>{detail.tipo==="gasto"?"−":"+"} {dinero(detail.monto)}</Text><Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">{detail.detalle||copy(detail.tipo==="gasto"?"expense":"income")}</Text><Text className="text-xs text-slate-500 dark:text-slate-300">{copy(detail.automatico?"automatic":"manual")} · {methodName(detail.metodo)} · {detail.fecha} · {horaVisible(detail.hora)}</Text>{detail.lineas.map((l,i)=><Text key={`${l.productoId}:${i}`} className="text-sm text-slate-700 dark:text-slate-200">{l.nombre} × {l.cantidad} · {dinero(Math.round(l.precio*l.cantidad*100)/100)}</Text>)}{canWrite&&mode==="categorias"&&detail.tipo==="ingreso"&&detail.clase!=="venta"?<>{detail.pendiente&&match.opciones.length?<><Text className="text-xs text-slate-600 dark:text-slate-300">{copy("suggestions")}</Text>{match.opciones.map((lines,i)=><BusinessChoice key={i} label={lines.map(l=>`${l.cantidad} × ${l.nombre}`).join(" + ")} onPress={()=>classify(detail,lines)}/>)}</>:null}<Text className="text-xs text-slate-500 dark:text-slate-300">{copy("preserveAmount")}</Text>{activos.map(p=><BusinessChoice key={p.id} label={p.nombre} onPress={()=>classify(detail,[{productoId:p.id,nombre:p.nombre,precio:detail.monto,cantidad:1}])}/>)}</>:null}{canWrite&&candidates.length?<BusinessButton secondary label={copy("reviewDuplicate")} onPress={()=>open({kind:"link",id:detail.key})}/>:null}{canWrite?<BusinessButton danger label={copy("delete")} onPress={()=>open({kind:"confirm-delete",keys:[detail.key]})}/>:null}</>;
    }
    if(panel.kind==="link")return <><Text className="text-xs text-amber-800 dark:text-amber-200">{copy("linkHint")}</Text>{candidates.map(r=><BusinessChoice key={r.key} label={r.detalle} detail={`${dinero(r.monto)} · ${r.fecha}`} onPress={()=>open({kind:"confirm-link",id:detail?.key,manualKey:r.key})}/>)}</>;
    if(panel.kind==="confirm-link")return <><Text className="text-sm text-slate-700 dark:text-slate-200">{copy("linkHint")}</Text><BusinessButton label={copy("link")} onPress={()=>{if(detail&&panel.manualKey)commit(()=>vincularCobroDelNegocio(activeId,detail.id,panel.manualKey!));}}/><BusinessButton secondary label={copy("cancel")} onPress={back}/></>;
    if(panel.kind==="confirm-yape")return <><Text className="text-sm text-slate-700 dark:text-slate-200">{copy("switchYape",{name:otroRecibe?.nombre??""})}</Text><BusinessButton label={copy("save")} onPress={()=>commit(()=>mandarYapesAlNegocio(activeId,true))}/><BusinessButton secondary label={copy("cancel")} onPress={back}/></>;
    if(panel.kind==="confirm-business")return <><Text className="text-sm text-slate-700 dark:text-slate-200">{copy("deleteBusinessHint",{name:negocio?.nombre??""})}</Text><BusinessButton danger label={copy("deleteBusiness")} onPress={()=>commit(async()=>{if(!await quitarNegocio(activeId))return false;setActiveId(negocios.find(n=>n.id!==activeId)?.id??"");return true;})}/><BusinessButton secondary label={copy("cancel")} onPress={back}/></>;
    if(panel.kind==="confirm-delete")return <><Text className="text-sm text-slate-700 dark:text-slate-200">{panel.id?copy("deleteCategoryHint"):copy(panel.keys?.length===1?"deleteOneHint":"deleteHint",{count:panel.keys?.length??0,name:negocio?.nombre??""})}</Text><BusinessButton danger label={copy("delete")} onPress={()=>commit(()=>panel.id?quitarProducto(panel.id):borrarFilasDelNegocio(activeId,panel.keys??[]),copy("deleted"))}/><BusinessButton secondary label={copy("cancel")} onPress={back}/></>;
    return null;
  }
  const header=<View className="gap-3 pb-2">
    <View className="flex-row items-center justify-between"><BackButton onPress={onBack}/><Text accessibilityRole="header" className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{copy("title")}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={copy("options")} onPress={()=>open({kind:negocio?"options":"businesses"})} className="h-11 w-11 items-center justify-center"><MoreHorizontal size={21} color="#64748b"/></TouchableOpacity></View>
    {soloLectura?<AvisoSoloLectura/>:null}
    <BusinessChoice testID="business-picker" label={negocio?.nombre??copy("businesses")} subtitle={negocio?copy(mode==="categorias"?"categoriesMode":"simpleMode"):undefined} large detail={`${copy("change")} ›`} onPress={()=>open({kind:"businesses"})}/>
    {negocio?<>
      {hayRegistroAutomatico(userCurrency) && (<View className="flex-row items-center justify-between gap-3"><View className="min-w-0 flex-1 gap-1"><Text className="text-xs font-bold text-slate-900 dark:text-slate-100">{copy("yape")}</Text><Text className="text-xs text-slate-500 dark:text-slate-300">{copy(!negocio.activo?"paused":recibeYapes?(autoCaptureOn?"yapeOn":"yapeSetup"):"yapeOff")}</Text></View><Toggle label={copy("yape")} disabled={soloLectura&&!recibeYapes} on={recibeYapes} onChange={setYapes}/></View>)}
      {recibeYapes&&!autoCaptureOn&&canWrite?<BusinessButton secondary label={copy("setup")} onPress={()=>irUnaVez("/auto-capture")}/>:null}
      <View><View className="flex-row border-b border-slate-200 dark:border-noche-borde">{(["hoy","mes","fechas"] as const).map(value=>{const selected=value==="fechas"?(period==="rango"||period==="todo"):period===value;return <TouchableOpacity key={value} testID={`business-period-${value}`} accessibilityRole="button" accessibilityState={{selected}} onPress={()=>value==="fechas"?open({kind:"dates",from,until}):choosePeriod(value)} className={`min-h-11 flex-1 items-center justify-center border-b-2 ${selected?"border-emerald-600":"border-transparent"}`}><Text className={`text-xs ${selected?"font-bold text-emerald-700 dark:text-emerald-300":"text-slate-600 dark:text-slate-300"}`}>{copy(value==="hoy"?"today":value==="mes"?"month":"dates")}</Text></TouchableOpacity>;})}</View>{period==="todo"||period==="rango"?<Text className="mt-1.5 text-xs text-slate-500 dark:text-slate-300">{period==="todo"?copy("allHistory"):`${from} – ${until}`}</Text>:null}</View>
      <View testID="business-summary-card" className="overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-600 dark:bg-noche-2"><View testID="business-totals" className={vertical?"gap-2 p-2":"flex-row gap-2 p-2"}>{(["ingresos","gastos"] as const).map(type=><View key={type} className={`min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-3 ${type==="ingresos"?"bg-emerald-50 dark:bg-emerald-700":"bg-rose-50 dark:bg-rose-700"}`}><Text className="mb-1 text-xs text-slate-600 dark:text-white">{copy(type==="ingresos"?"incomes":"expenses")}</Text><Text testID={`business-total-${type}`} className={`text-[22px] font-extrabold ${type==="ingresos"?"text-emerald-700 dark:text-white":"text-rose-600 dark:text-white"}`}>{dinero(totals[type])}</Text></View>)}</View><View testID="business-result-divider" className="mx-3 h-px bg-slate-300 dark:bg-noche-borde"/><View className="min-h-11 flex-row items-center justify-between gap-3 px-3"><Text className="text-sm font-semibold text-slate-800 dark:text-slate-100">{copy("result")}</Text><Text testID="business-result-amount" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} className={`max-w-[65%] text-right text-base font-extrabold ${result>0?"text-emerald-700 dark:text-emerald-300":result<0?"text-rose-700 dark:text-rose-300":"text-slate-700 dark:text-slate-200"}`}>{dinero(result)}</Text></View></View>
      <View className="flex-row items-stretch gap-2.5">{canWrite?<View className="min-w-0 flex-1"><BusinessButton testID="business-register" label={`+ ${copy("register")}`} onPress={register}/></View>:null}{pending>0||filters.pendientes?<TouchableOpacity testID="business-pending" accessibilityRole="button" accessibilityState={{selected:filters.pendientes}} onPress={()=>changeFilter({...BUSINESS_FILTER,pendientes:!filters.pendientes})} className={`min-h-11 flex-row items-center justify-center gap-1 rounded-xl border px-3 ${filters.pendientes?"border-amber-700 bg-amber-200 dark:border-amber-400 dark:bg-amber-800":"border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"}`}><Text className="text-xs font-semibold text-amber-900 dark:text-amber-100">{copy("pending")} · {pending}</Text><Text className="text-xs font-bold text-amber-900 dark:text-amber-100">{filters.pendientes?"✓":"›"}</Text></TouchableOpacity>:null}</View>
      {canWrite?<Text className="-mt-1 text-xs text-slate-500 dark:text-slate-300">{copy(mode==="categorias"?"quickHint":"simpleHint")}</Text>:null}
      {undo&&undo.businessId===activeId&&canWrite?<BusinessButton secondary label={copy("undo")} onPress={()=>commit(async()=>{if(!await borrarFilasDelNegocio(undo.businessId,[`movimiento:${undo.id}`]))return false;setUndo(null);return true;})}/>:null}
      <View className="mt-1 flex-row flex-wrap items-center justify-between gap-1"><Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{copy("movements")} · {rows.length}</Text><View className="flex-row items-center gap-3">{["search","filters",...(canWrite?["select"]:[])] .map(action=><TouchableOpacity key={action} accessibilityRole="button" onPress={()=>action==="search"?setSearchOpen(!searchOpen):action==="filters"?open({kind:"filters",filter:{...filters}}):(setSelecting(!selecting),setSelectedKeys([]))} className="min-h-11 justify-center"><Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{copy(action==="select"&&selecting?"cancel":action as "search"|"filters"|"select")}</Text></TouchableOpacity>)}</View></View>
      {searchOpen||filters.buscar?<TextInput disableFullscreenUI accessibilityLabel={copy("search")} placeholder={copy("search")} placeholderTextColor="#64748b" value={filters.buscar} onChangeText={buscar=>changeFilter({...filters,buscar})} className="min-h-11 rounded-xl border border-slate-200 px-3 text-base text-slate-900 dark:border-noche-borde dark:text-slate-100"/>:null}
      {hasFilters?<TouchableOpacity accessibilityRole="button" onPress={()=>changeFilter({...BUSINESS_FILTER})} className="min-h-11 justify-center"><Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{copy("clear")}</Text></TouchableOpacity>:null}
      {selecting&&canWrite?<View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-noche-2"><TouchableOpacity accessibilityRole="checkbox" accessibilityState={{checked:rows.length>0&&selected.length===rows.length?true:selected.length?"mixed":false}} onPress={()=>setSelectedKeys(selected.length===rows.length?[]:rows.map(r=>r.key))} className="min-h-11 flex-row items-center gap-2"><Text className="font-bold text-emerald-700 dark:text-emerald-300">{rows.length&&selected.length===rows.length?"☑":"□"}</Text><Text className="text-xs text-slate-800 dark:text-slate-100">{copy("selectAll",{count:rows.length})}</Text></TouchableOpacity><BusinessButton danger disabled={!selected.length} label={`${copy("delete")} (${selected.length})`} onPress={()=>open({kind:"confirm-delete",keys:[...selected]})}/></View>:null}
    </>:canWrite?<BusinessButton label={`+ ${copy("createBusiness")}`} onPress={()=>newBusiness()}/>:null}
  </View>;
  return <View className="flex-1 bg-white dark:bg-noche" style={{paddingTop:insets.top,paddingBottom:insets.bottom}}>
    <FlatList data={rows} keyExtractor={r=>r.key} ListHeaderComponent={header} contentContainerStyle={{paddingHorizontal:16,paddingBottom:24}} keyboardShouldPersistTaps="handled" initialNumToRender={18} maxToRenderPerBatch={18} windowSize={7} ListEmptyComponent={negocio?<Text className="py-8 text-center text-sm text-slate-500 dark:text-slate-300">{copy("empty")}</Text>:null} ListFooterComponent={<Text className="pt-5 text-center text-xs text-slate-500 dark:text-slate-300">{copy("separate")}</Text>} renderItem={({item:r,index})=>{
      const amountForeground=r.tipo==="gasto"?"text-rose-700 dark:text-rose-300":"text-emerald-700 dark:text-emerald-300";
      const methodTone=METHOD_TONE[r.metodo];
      const sourceLabel=r.tipo==="gasto"?(r.automatico?"expenseAutomatic":"expenseManual"):(r.automatico?"incomeAutomatic":"incomeManual");
      return <View>
        {startsMovementDay(rows,index,item=>item.fecha)?<MovementDateHeader date={r.fecha} monthNames={app.monthNames}/>:null}
        <TouchableOpacity testID={`business-row-${r.key}`} accessibilityRole={selecting?"checkbox":"button"} accessibilityState={selecting?{checked:selectedSet.has(r.key)}:undefined} accessibilityLabel={`${r.detalle||copy(r.tipo==="gasto"?"expense":"income")}, ${dinero(r.monto)}`} onPress={()=>selecting?setSelectedKeys(previous=>previous.includes(r.key)?previous.filter(k=>k!==r.key):[...previous,r.key]):open({kind:"detail",id:r.key})} className="my-1 min-h-[72px] flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-noche-borde dark:bg-noche-2">
          {selecting?<View className={`h-5 w-5 items-center justify-center rounded border ${selectedSet.has(r.key)?"border-emerald-600 bg-emerald-600":"border-slate-400"}`}>{selectedSet.has(r.key)?<Check size={14} color="#fff"/>:null}</View>:null}
          <View className="min-w-0 flex-1 gap-1"><Text numberOfLines={1} className="text-sm font-bold text-slate-900 dark:text-slate-100">{r.detalle||copy(r.pendiente?"noMatch":r.tipo==="gasto"?"expense":"income")}</Text><Text numberOfLines={1} className="text-[11px] text-slate-500 dark:text-slate-300">{horaVisible(r.hora)} · {copy(sourceLabel)}</Text>{r.pendiente?<Text className="text-xs text-amber-800 dark:text-amber-200">{copy("classify")} ›</Text>:null}</View>
          <View className="min-w-0 shrink-0 items-end gap-1" style={{maxWidth:width*0.43}}><Text testID={`business-amount-${r.key}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} className={`max-w-full text-right text-sm font-extrabold ${amountForeground}`}>{r.tipo==="gasto"?"−":"+"} {dinero(r.monto)}</Text><View testID={`business-method-${r.key}`} className={`max-w-full rounded-full px-2.5 py-1 ${methodTone.background}`}><Text numberOfLines={1} className={`text-[10px] font-semibold ${methodTone.foreground}`}>{methodName(r.metodo)}</Text></View></View>
        </TouchableOpacity>
      </View>;
    }}/>
    {panel?<BusinessSheet title={sheetTitle()} onClose={close} onBack={panels.length>1?back:undefined} backLabel={copy("back")} closeLabel={copy("close")}><View pointerEvents={saving?"none":"auto"}>{sheetBody()}</View>{saving?<Text accessibilityLiveRegion="polite" className="text-sm text-slate-600 dark:text-slate-300">{app.t("common.saving")}</Text>:null}{error?<Text accessibilityRole="alert" className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</Text>:null}</BusinessSheet>:null}
  </View>;
}
