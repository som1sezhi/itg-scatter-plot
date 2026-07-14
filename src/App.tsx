import { useEffect, useLayoutEffect, useState } from "react";
import "./App.css";
import Plot from "./components/Plot";
import type { DataPoint } from "./types";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Stack, Paper } from "@mui/material";
import AddAPoint from "./components/options-panel/AddAPoint";
import StreamDensityFilter from "./components/options-panel/StreamDensityFilter";

function App() {
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "horizontal",
  );
  const [data, setData] = useState<DataPoint[]>([]);

  const [customPoint, setCustomPoint] = useState<DataPoint | null>(null);
  const [densityRange, setDensityRange] = useState<[number, number]>([0, 1]);
  // const [dims, setDims] = useState<[number, number]>([0, 0]);

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

  useLayoutEffect(() => {
    function updateOrientation() {
      setOrientation(window.innerWidth < 640 ? "vertical" : "horizontal");
      // setDims([window.innerWidth, window.innerHeight]);
    }
    window.addEventListener("resize", updateOrientation);
    updateOrientation();
    return () => window.removeEventListener("resize", updateOrientation);
  }, []);

  // const densityMin = Math.max(0, densityCenter - densityRadius) / 100;
  // const densityMax = Math.min(100, densityCenter + densityRadius) / 100;

  return (
    <Group orientation={orientation}>
      <Panel defaultSize="75%">
        <Plot
          data={data}
          customPoint={customPoint}
          densityRange={densityRange}
        />
      </Panel>

      <Separator className="separator" />

      <Panel collapsible minSize={30}>
        {/* wrapping div required to let contents touch-scroll
        no matter the panel orientation */}
        <div className="settings-container">
          {/* <div>
            {dims[0]}, {dims[1]}
          </div> */}
          <Stack sx={{ p: 1 }} spacing={1}>
            <Paper sx={{ p: 2 }} elevation={4}>
              <AddAPoint updateDataPoint={setCustomPoint} />
            </Paper>
            <Paper sx={{ p: 2 }} elevation={4}>
              <StreamDensityFilter
                densityRange={densityRange}
                updateDensity={setDensityRange}
              />
            </Paper>
          </Stack>
        </div>
      </Panel>
    </Group>
  );
}

export default App;
