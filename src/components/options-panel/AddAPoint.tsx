import NumberField from "../NumberField";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  styled,
  TextField,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { useCallback, useState, type ChangeEvent } from "react";
import type { DataPoint } from "../../types";
import { CommonSelect, NumberField0To100 } from "./common";
import {
  analyzeSegments,
  breakdownString,
  ChartAnalyzer,
  parseBreakdown,
  runsToSegments,
} from "../../analysis";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { Simfile } from "../../simfile/Simfile";

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

export default function AddAPoint({
  updateDataPoint,
}: {
  updateDataPoint: (p: DataPoint | null) => void;
}) {
  const [scheme, setScheme] = useState<"params" | "bd" | "file">("params");

  const [bpm, setBpm] = useState<number | null>(null);
  const [totalStream, setTotalStream] = useState<number | null>(null);
  const [density, setDensity] = useState<number | null>(null);

  const [breakdown, setBreakdown] = useState<string>("");
  const [breakdownErr, setBreakdownErr] = useState<string>("");

  const [sim, setSim] = useState<Simfile | null>(null);
  const [analyzers, setAnalyzers] = useState<ChartAnalyzer[]>([]);
  const [chartIdx, setChartIdx] = useState<number>(-1);

  const [helperText, setHelperText] = useState<string>("");

  function fromThreeParams(
    bpm: number | null,
    totalStream: number | null,
    density: number | null,
  ): DataPoint | null {
    if (!bpm || !totalStream || !density) {
      return null;
    }
    return {
      name: "<custom data point>",
      hash: "",
      meter: null,
      bpm: bpm,
      totalStream: totalStream,
      streamDensity: density / 100,
      segments: [],
      isCustom: true,
    };
  }

  const updateFromBreakdown = useCallback(
    (bpm: number | null, bd: string) => {
      const result = parseBreakdown(bd);
      if (result.error) {
        updateDataPoint(null);
        setBreakdownErr(result.error);
        setHelperText("");
        return;
      }
      setBreakdownErr("");

      if (result.segments.length === 0 || !bpm) {
        updateDataPoint(null);
        setHelperText("");
        return;
      }

      const { totalStream, streamDensity } = analyzeSegments(result.segments);
      updateDataPoint({
        name: "<custom data point>",
        hash: "",
        meter: null,
        bpm: bpm,
        totalStream,
        streamDensity,
        segments: result.segments,
        isCustom: true,
      });
      setHelperText(
        `${totalStream} total, ${Math.round(streamDensity * 100)}% density`,
      );

      setBpm(bpm);
      setTotalStream(totalStream);
      setDensity(streamDensity * 100);
    },
    [updateDataPoint],
  );

  function updateFromAnalyzer(analyzer: ChartAnalyzer | undefined) {
    if (!analyzer) {
      updateDataPoint(null);
      setHelperText("");
      return;
    }

    const info = analyzer.getStreamInfo();
    if (info.totalStream === 0) {
      updateDataPoint(null);
      setHelperText("No stream found");
      return;
    }
    const mult = info.quant / 16;
    const bpm = Math.round(info.avgBpm! * mult * 100) / 100;
    const stream = info.totalStream * mult;
    const density =
      Math.round(
        (info.totalStream / (info.totalStream + info.totalBreak)) * 10000,
      ) / 10000;

    let name = analyzer.sim.title;
    if (analyzer.sim.subtitle) {
      name += " " + analyzer.sim.subtitle;
    }
    if (analyzer.chart.difficulty !== 4) {
      name += " (" + analyzer.getDiffStr() + ")";
    }
    updateDataPoint({
      name,
      hash: "",
      meter: analyzer.chart.meter,
      bpm: bpm,
      totalStream: stream,
      streamDensity: density,
      segments: [],
      isCustom: true,
    });
    setHelperText(
      `${bpm} BPM, ${stream} total, ${Math.round(density * 100)}% density`,
    );

    setBpm(bpm);
    setTotalStream(stream);
    setDensity(density * 100);
    setBreakdown(breakdownString(runsToSegments(info.runs)));
    setBreakdownErr("");
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const file = event.target.files[0];
    const ext = file.name
      .substring(file.name.lastIndexOf(".") + 1)
      .toLowerCase();
    if (ext !== "sm" && ext !== "ssc") return;
    file.text().then((text) => {
      const sim = new Simfile(text, ext);
      setSim(sim);
      const analyzers = sim.charts
        .filter((chart) => chart.stepsType === "dance-single")
        .map((chart) => new ChartAnalyzer(sim, chart, "individual"));
      setAnalyzers(analyzers);
      // NOTE: chartIdx might have a stale value here, but at least the
      // new value should never be invalid
      const newChartIdx = Math.min(Math.max(0, chartIdx), analyzers.length - 1);
      setChartIdx(newChartIdx);
      // NOTE: newChartIdx can be -1 if analyzers is empty. this is ok
      // since updateFromAnalyzer accepts undefined as input
      updateFromAnalyzer(analyzers[newChartIdx]);
    });
  };

  // when switching scheme, keep the data point updated to match the
  // currently-displayed input data
  const onSchemeChange = (event: SelectChangeEvent<typeof scheme>) => {
    const val = event.target.value;
    setScheme(val);

    if (val === "params") {
      updateDataPoint(fromThreeParams(bpm, totalStream, density));
    } else if (val === "bd") {
      updateFromBreakdown(bpm, breakdown);
    } else {
      updateFromAnalyzer(analyzers[chartIdx]);
    }
  };

  const onChartChange = (event: SelectChangeEvent<number>) => {
    const newChartIdx = Number(event.target.value);
    setChartIdx(newChartIdx);
    updateFromAnalyzer(analyzers[newChartIdx]);
  };

  return (
    <Stack spacing={1}>
      <div>
        <Typography variant="h6" gutterBottom>
          Add a point
        </Typography>
      </div>

      <CommonSelect
        label="Input scheme"
        value={scheme}
        onChange={onSchemeChange}
      >
        <MenuItem value={"params"}>Chart info</MenuItem>
        <MenuItem value={"bd"}>Full breakdown</MenuItem>
        <MenuItem value={"file"}>Simfile upload</MenuItem>
      </CommonSelect>

      {scheme === "params" ? (
        <Stack spacing={2}>
          <NumberField
            label="BPM"
            size="small"
            min={1}
            step={1}
            value={bpm}
            format={{ useGrouping: false }}
            onValueCommitted={(val) => {
              setBpm(val);
              updateDataPoint(fromThreeParams(val, totalStream, density));
            }}
          />
          <NumberField
            label="Total stream"
            size="small"
            min={1}
            step={1}
            value={totalStream}
            format={{ useGrouping: false }}
            onValueCommitted={(val) => {
              setTotalStream(val);
              updateDataPoint(fromThreeParams(bpm, val, density));
            }}
          />
          <NumberField0To100
            label="% density"
            value={density}
            onValueCommitted={(val) => {
              setDensity(val);
              updateDataPoint(fromThreeParams(bpm, totalStream, val));
            }}
          />
        </Stack>
      ) : scheme === "bd" ? (
        <Stack spacing={2}>
          <NumberField
            label="BPM"
            size="small"
            min={1}
            step={1}
            value={bpm}
            format={{ useGrouping: false }}
            onValueCommitted={(val) => {
              setBpm(val);
              updateFromBreakdown(val, breakdown);
            }}
          />
          <Stack spacing={1}>
            <TextField
              id="breakdown-input"
              label="Full breakdown"
              multiline
              rows={3}
              size="small"
              value={breakdown}
              placeholder="e.g. 32 (8) 23 7 (2) 1"
              onChange={(e) => setBreakdown(e.target.value)}
              onBlur={() => updateFromBreakdown(bpm, breakdown)}
              error={breakdownErr !== ""}
              helperText={breakdownErr}
            />
            {helperText && (
              <Box>
                <Typography>{helperText}</Typography>
              </Box>
            )}
          </Stack>
        </Stack>
      ) : (
        // scheme === "file"
        <Stack spacing={2}>
          <Button
            component="label"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            startIcon={<UploadFileIcon />}
          >
            Choose file
            <VisuallyHiddenInput type="file" onChange={onFileChange} />
          </Button>
          {sim && (
            <Stack spacing={0}>
              <Box sx={{ pb: 2 }}>
                <Typography>
                  <b>{sim.title + (sim.subtitle ? " " + sim.subtitle : "")}</b>
                </Typography>
              </Box>
              <CommonSelect
                label="Chart"
                value={chartIdx}
                onChange={onChartChange}
              >
                {analyzers.map((analyzer, i) => (
                  <MenuItem key={i} value={i}>
                    {analyzer.getDiffStr()} {analyzer.chart.meter}
                  </MenuItem>
                ))}
              </CommonSelect>
              {helperText && (
                <Box>
                  <Typography>{helperText}</Typography>
                </Box>
              )}
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
}
