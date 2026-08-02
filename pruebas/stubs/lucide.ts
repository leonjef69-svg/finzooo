// Los iconos no pintan nada al probar con Node: solo tienen que existir para
// que constants/categories se pueda cargar.
const icono = () => null;
export default new Proxy({}, { get: () => icono });
export const Utensils = icono, Car = icono, Fuel = icono, Repeat = icono,
  ShoppingBag = icono, Film = icono, Gamepad2 = icono, HeartPulse = icono,
  Zap = icono, GraduationCap = icono, PawPrint = icono, Home = icono,
  MoreHorizontal = icono, Briefcase = icono, Laptop = icono, Gift = icono,
  TrendingUp = icono, Tag = icono, PlusCircle = icono, Crown = icono,
  HandCoins = icono, BarChart3 = icono, KeyRound = icono, Coins = icono;
