import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

export default function BudgetRing({ pct }: { pct: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(pct, 100);
  const dash = c - (clamped / 100) * c;
  const color = pct >= 100 ? "#f43f5e" : pct >= 80 ? "#f59e0b" : "#10b981";

  return (
    <View style={{ width: 96, height: 96 }}>
      <Svg width={96} height={96} viewBox="0 0 96 96">
        <Circle cx={48} cy={48} r={r} stroke="#e2e8f0" strokeWidth={9} fill="none" />
        <Circle
          cx={48}
          cy={48}
          r={r}
          stroke={color}
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dash}
          rotation={-90}
          origin="48, 48"
        />
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#ffffff" }}>
          {Math.round(clamped)}%
        </Text>
      </View>
    </View>
  );
}
