import { useEffect, useLayoutEffect, useState } from "react";
import "./App.css";
import Plot from "./components/Plot";
import type { DataPoint } from "./types";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  Slider,
  Stack,
  Typography,
  Grid,
  Box,
  InputLabel,
  MenuItem,
  Select,
  FormControl,
  Paper,
  type SliderProps,
} from "@mui/material";
import NumberField, { type NumberFieldProps } from "./components/NumberField";

function App() {
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">(
    "horizontal",
  );
  const [data, setData] = useState<DataPoint[]>([]);
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
        <Plot data={data} densityRange={densityRange} />
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

function Slider0To1(props: SliderProps) {
  return (
    <Box sx={{ px: "8px" }}>
      <Slider min={0} max={1} step={0.01} {...props} />
    </Box>
  );
}

function NumberField0To100(props: NumberFieldProps) {
  return <NumberField size="small" min={0} max={100} step={1} {...props} />;
}

function StreamDensityFilter({
  densityRange,
  updateDensity,
}: {
  densityRange: [number, number];
  updateDensity: (
    update: [number, number] | ((d: [number, number]) => [number, number]),
  ) => void;
}) {
  const [rangeScheme, setRangeScheme] = useState<"range" | "center">("range");
  return (
    <>
      <Stack spacing={1}>
        <div>
          <Typography variant="h6" gutterBottom>
            Filter by density
          </Typography>
        </div>
        <FormControl>
          <InputLabel id="range-scheme-label">
            Range selection scheme
          </InputLabel>
          <Select
            labelId="range-scheme-label"
            id="range-scheme"
            value={rangeScheme}
            onChange={(e) => {
              setRangeScheme(e.target.value);
              updateDensity(([a, b]) => [Math.max(0, a), Math.min(1, b)]);
            }}
            label="Range scheme"
            size="small"
            sx={{ mb: 1 }}
          >
            <MenuItem value={"range"}>Min to max</MenuItem>
            <MenuItem value={"center"}>Center &plusmn; radius</MenuItem>
          </Select>
        </FormControl>

        {rangeScheme === "range" ? (
          <>
            <Slider0To1
              value={densityRange}
              onChange={(_, newVal) =>
                updateDensity(newVal as [number, number])
              }
            />
            <Grid container spacing={1}>
              <Grid size={6}>
                <NumberField0To100
                  label="Min %"
                  value={densityRange[0] * 100}
                  onValueCommitted={(val) =>
                    updateDensity(([_, b]) => [
                      Math.min(val ? val / 100 : 0, b),
                      Math.max(val ? val / 100 : 0, b),
                    ])
                  }
                />
              </Grid>
              <Grid size={6}>
                <NumberField0To100
                  label="Max %"
                  value={densityRange[1] * 100}
                  onValueCommitted={(val) =>
                    updateDensity(([a, _]) => [
                      Math.min(val ? val / 100 : 0, a),
                      Math.max(val ? val / 100 : 0, a),
                    ])
                  }
                />
              </Grid>
            </Grid>
          </>
        ) : (
          <>
            <Grid container spacing={2}>
              <Grid size={8}>
                <Slider0To1
                  value={(densityRange[0] + densityRange[1]) / 2}
                  onChange={(_, val) => {
                    updateDensity(([a, b]) => {
                      const mid = val as number;
                      const radius = (b - a) / 2;
                      return [mid - radius, mid + radius];
                    });
                  }}
                />
              </Grid>
              <Grid size={4}>
                <NumberField0To100
                  label="Center (%)"
                  value={(densityRange[0] + densityRange[1]) * 50}
                  onValueCommitted={(val) =>
                    updateDensity(([a, b]) => {
                      const mid = (val ?? 0) / 100;
                      const radius = (b - a) / 2;
                      return [mid - radius, mid + radius];
                    })
                  }
                />
              </Grid>
              <Grid size={8}>
                <Slider0To1
                  value={(densityRange[1] - densityRange[0]) / 2}
                  onChange={(_, val) => {
                    updateDensity(([a, b]) => {
                      const mid = (a + b) / 2;
                      const radius = val as number;
                      return [mid - radius, mid + radius];
                    });
                  }}
                />
              </Grid>
              <Grid size={4}>
                <NumberField0To100
                  label="Radius (%)"
                  value={(densityRange[1] - densityRange[0]) * 50}
                  onValueCommitted={(val) =>
                    updateDensity(([a, b]) => {
                      const mid = (a + b) / 2;
                      const radius = (val ?? 0) / 100;
                      return [mid - radius, mid + radius];
                    })
                  }
                />
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </>
  );
}
