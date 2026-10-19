import BusinessWorkspace from "@/screens/BusinessWorkspace";
export default function Negocios({onBack,soloLectura=false}:{onBack:()=>void;soloLectura?:boolean}) {
  return <BusinessWorkspace onBack={onBack} soloLectura={soloLectura}/>;
}
