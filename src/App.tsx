import { useEffect, useState } from "react";
import "./App.css";
import Plot from "./components/Plot";
import type { DataPoint } from "./types";

function App() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [densityCenter, setDensityCenter] = useState<number>(100);
  const [densityRadius, setDensityRadius] = useState<number>(100);

  useEffect(() => {
    fetch("/dataset.json")
      .then((response) => response.json())
      .then((data: DataPoint[]) => {
        data.forEach((d) => {
          d.name = d.name.replace(/\[\d+\] ?\[\d+\] /, "");
          d.name = d.name.replace(/Stamina RPG /, "SRPG");
        });
        setData(data);
      });
  }, []);

  const densityMin = Math.max(0, densityCenter - densityRadius) / 100;
  const densityMax = Math.min(100, densityCenter + densityRadius) / 100;

  return (
    <>
      <div className="topbar">
        Filter by density:
        <input
          type="range"
          min="0"
          max="100"
          value={densityCenter}
          onChange={(e) => setDensityCenter(+e.target.value)}
        />
        <input
          type="range"
          min="0"
          max="100"
          value={densityRadius}
          onChange={(e) => setDensityRadius(+e.target.value)}
        />
      </div>
      <Plot data={data} densityMin={densityMin} densityMax={densityMax} />
    </>
  );
}

export default App;
