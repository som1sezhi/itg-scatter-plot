import { useEffect, useState } from "react";
import "./App.css";
import Plot from "./components/Plot";
import type { DataPoint } from "./types";

function App() {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    fetch("/dataset.json")
      .then((response) => response.json())
      .then((data: DataPoint[]) => {
        setData(data);
      });
  }, []);

  return (
    <>
      <Plot data={data} />
    </>
  );
}

export default App;
