import { Stack, Typography, MenuItem, Grid } from "@mui/material";
import { useState } from "react";
import { Slider0To1, NumberField0To100, CommonSelect } from "./common";

export default function StreamDensityFilter({
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
    <Stack spacing={1}>
      <div>
        <Typography variant="h6" gutterBottom>
          Filter by density
        </Typography>
      </div>

      <CommonSelect
        label="Range selection scheme"
        value={rangeScheme}
        onChange={(e) => {
          setRangeScheme(e.target.value);
          updateDensity(([a, b]) => [Math.max(0, a), Math.min(1, b)]);
        }}
      >
        <MenuItem value={"range"}>Min to max</MenuItem>
        <MenuItem value={"center"}>Center &plusmn; radius</MenuItem>
      </CommonSelect>

      {rangeScheme === "range" ? (
        <>
          <Slider0To1
            value={densityRange}
            onChange={(_, newVal) => updateDensity(newVal as [number, number])}
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
          <Grid container rowSpacing={2} columnSpacing={1}>
            <Grid size={7}>
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
            <Grid size={5}>
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
            <Grid size={7}>
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
            <Grid size={5}>
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
  );
}
