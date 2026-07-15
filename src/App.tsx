import { useEffect, useLayoutEffect, useState } from "react";
import "./App.css";
import Plot from "./components/Plot";
import type { DataPoint } from "./types";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Stack, Paper, Button } from "@mui/material";
import AddAPoint from "./components/options-panel/AddAPoint";
import StreamDensityFilter from "./components/options-panel/StreamDensityFilter";
import InfoOutlineRounded from "@mui/icons-material/InfoOutlineRounded";
import AboutDialog from "./components/AboutDialog";

function App() {
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "horizontal",
  );
  const [data, setData] = useState<DataPoint[]>([]);
  const [showAbout, setShowAbout] = useState<boolean>(false);

  const [customPoint, setCustomPoint] = useState<DataPoint | null>(null);
  const [densityRange, setDensityRange] = useState<[number, number]>([0, 1]);
  // const [dims, setDims] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    fetch("dataset.json")
      .then((response) => response.json())
      .then((data: DataPoint[]) => {
        data.forEach((d) => {
          d.name = d.name.replace(/\[\d+\] ?\[\d+\] /, "");
          d.pack = d.pack.replace(/Stamina RPG /, "SRPG");
          d.pack = d.pack.replace(/ - [\w\s]+$/, "");
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
    <>
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
              <Button
                variant="contained"
                startIcon={<InfoOutlineRounded />}
                onClick={() => setShowAbout(true)}
              >
                About
              </Button>
            </Stack>
          </div>
        </Panel>
      </Group>
      <AboutDialog
        open={showAbout}
        data={data}
        onClose={() => setShowAbout(false)}
      />
    </>
  );
}

export default App;
