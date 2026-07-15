import type { Chart } from "./simfile/Chart";
import { NoteTypes, type Note } from "./simfile/Note";
import type { Simfile } from "./simfile/Simfile";
import { TimingData } from "./simfile/TimingData";
import { TimingEngine } from "./simfile/TimingEngine";
import { beatToRow, ROWS_PER_MEASURE } from "./simfile/utils";

export type JumpsHandlingMode = "individual" | "jumps" | "brackets";

const SPACING = 1;
const SUPPORT_RADIUS = 1.5 * SPACING;

function kernel(x: number) {
  x = x / SPACING + 1.5;

  let y;
  if (x <= 1) {
    y = (x * x) / 2;
  } else if (x <= 2) {
    y = (2 - x) * (x - 1) + 0.5;
  } else {
    x = x - 3;
    y = (x * x) / 2;
  }

  return y / SPACING;
}

export function* npsSeqIterator(
  noteTimes: Iterable<number, void>,
): Generator<number, void> {
  const iter = noteTimes[Symbol.iterator]();
  const queue: number[] = [];

  const first = iter.next();
  if (first.done) return; // empty iterator
  let sampleLoc = Math.ceil((first.value - SUPPORT_RADIUS) / SPACING) * SPACING;
  queue.push(first.value);

  while (queue.length > 0) {
    const lBound = sampleLoc - SUPPORT_RADIUS;
    const rBound = sampleLoc + SUPPORT_RADIUS;
    // add new notes, ensuring last note in queue is beyond the
    // window, if possible
    if (queue[queue.length - 1] < rBound) {
      let next = iter.next();
      while (!next.done && next.value < rBound) {
        queue.push(next.value);
        next = iter.next();
      }
      if (!next.done) queue.push(next.value);
    }
    // clear old notes
    while (queue.length > 0 && queue[0] < lBound) queue.shift();

    let accum = 0;
    for (const time of queue)
      if (time < rBound) accum += kernel(sampleLoc - time);
    yield accum;
    sampleLoc += SPACING;
  }
}

export interface StreamRun {
  start: number;
  len: number;
}

interface ParseResult {
  segments: number[];
  error?: string;
}

export function parseBreakdown(bd: string): ParseResult {
  const parts = bd.split(/\s+/);
  const segs: number[] = [];
  for (const part of parts) {
    if (part.length === 0) continue;

    const isBreak = part[0] === "(" && part[part.length - 1] === ")";

    const val = parseFloat(isBreak ? part.slice(1, -1) : part);
    if (isNaN(val)) {
      return { segments: [], error: `Could not parse "${part}"` };
    } else if (val <= 0) {
      return {
        segments: [],
        error: `Non-positive segment "${part}" is disallowed`,
      };
    }

    if (isBreak && segs.length > 0) {
      if (segs[segs.length - 1] < 0) {
        segs[segs.length - 1] -= val; // add to existing break at end
      } else {
        segs.push(-val); // add break
      }
      // do not add breaks that are at the beginning
    } else if (!isBreak) {
      segs.push(val); // add stream
    }
  }

  // remove trailing break
  if (segs.length > 0 && segs[segs.length - 1] < 0) {
    segs.pop();
  }

  return { segments: segs };
}

export function analyzeSegments(segments: number[]): {
  totalStream: number;
  totalBreak: number;
  streamDensity: number;
} {
  let totalStream = 0;
  let totalBreak = 0;
  let prevSeg = -1;
  for (const seg of segments) {
    if (seg > 0 && prevSeg > 0) {
      totalBreak += 1;
    }
    if (seg < 0) {
      totalBreak -= seg;
    } else {
      totalStream += seg;
    }
    prevSeg = seg;
  }

  return {
    totalStream,
    totalBreak,
    streamDensity: totalStream / (totalStream + totalBreak),
  };
}

export function runsToSegments(runs: StreamRun[], mult: number): number[] {
  const segs = [];
  let prevRunEnd = 0;
  for (const run of runs) {
    if (segs.length > 0) {
      const breakLen = (run.start - prevRunEnd) * mult;
      if (breakLen !== 1) segs.push(-breakLen);
    }
    segs.push(run.len * mult);
    prevRunEnd = run.start + run.len;
  }
  return segs;
}

export function segmentsToDensityGraph(
  segs: number[],
  bpm: number,
): [number, number][] {
  function measuresToTime(measure: number) {
    return (240 / bpm) * measure;
  }
  const nps = bpm / 15;

  let curMeasure = 0;
  let numDeferredNotes = 0;
  const graph: [number, number][] = [];

  function handleSegment(length: number, nps: number) {
    const curMeasureFloor = Math.floor(curMeasure);
    const segEnd = curMeasure + length;
    const segEndFloor = Math.floor(segEnd);
    // split into 3 parts (lengths are measured in measures):
    // try to fill up the first (maybe fractional) unfinished measure
    // as much as possible
    const part1Len = Math.min(curMeasureFloor + 1, segEnd) - curMeasure;
    const part1FillsMeasure = segEnd >= curMeasureFloor + 1;
    // fill as many additional full measures as possible
    const part2Len = Math.max(0, segEndFloor - (curMeasureFloor + 1));
    // add fractional leftover
    const part3Len = length - part1Len - part2Len;

    // handle part 1
    const part1Notes = measuresToTime(part1Len) * nps;
    numDeferredNotes += part1Notes;
    if (part1FillsMeasure) {
      graph.push([
        measuresToTime(curMeasureFloor),
        numDeferredNotes / measuresToTime(1),
      ]);
      numDeferredNotes = 0;

      if (part2Len > 0) {
        graph.push([measuresToTime(curMeasureFloor + 1), nps]);
        if (segEndFloor - 1 > curMeasureFloor + 1) {
          graph.push([measuresToTime(segEndFloor - 1), nps]);
        }
      }

      if (part3Len > 0) {
        const part3Notes = measuresToTime(part3Len) * nps;
        numDeferredNotes += part3Notes;
      }
    }

    curMeasure = segEnd;
  }

  let prevSeg = -1;
  for (const seg of segs) {
    if (seg > 0) {
      if (prevSeg > 0) {
        // implied 1m break
        handleSegment(1, 0);
      }
      // add stream
      handleSegment(seg, nps);
    } else {
      // add break
      handleSegment(-seg, 0);
    }
    prevSeg = seg;
  }

  if (numDeferredNotes > 0) {
    graph.push([
      measuresToTime(Math.floor(curMeasure)),
      numDeferredNotes / measuresToTime(1),
    ]);
    curMeasure++;
  }
  graph.push([measuresToTime(Math.floor(curMeasure)), 0]);

  return graph;
}

export function breakdownStringFull(segs: number[]): string {
  let parts = [];
  for (const seg of segs) {
    if (seg > 0) parts.push(seg.toString());
    else if (seg !== -1) parts.push(`(${-seg})`);
  }
  return parts.join(" ");
}

function breakdownStringSimplified(
  segs: number[],
  simplifyLevel: number,
  maxBreakdownParts: number,
): string | null {
  const bdParts: string[] = [];
  let accumStream = 0;
  let isBroken = false;

  function addPart(breakLen: number | null = null) {
    let part = accumStream.toString();
    if (isBroken) part += "*";
    if (breakLen !== null) {
      if (breakLen < 2) part += "'";
      else if (breakLen < 5) part += "-";
      else if (breakLen < 32) part += " / ";
      else part += " | ";
    }
    bdParts.push(part);
    accumStream = 0;
    isBroken = false;
  }

  segs.forEach((seg, i) => {
    if (bdParts.length >= maxBreakdownParts) {
      return null;
    }

    // is stream?
    if (seg > 0) {
      // if prev seg was also stream, this indicates a 1m break
      if (i > 0 && segs[i - 1] > 0) {
        if (simplifyLevel === 1) {
          addPart(1);
        } else {
          accumStream += 1;
          isBroken = true;
        }
      }
      // add current stream segment
      accumStream += seg;
    } else {
      // is break
      const breakLen = -seg;
      if (simplifyLevel === 3 && breakLen < 5) {
        accumStream += breakLen;
        isBroken = true;
      } else {
        addPart(breakLen);
      }
    }
  });

  if (bdParts.length === maxBreakdownParts) return null;
  // add remaining stream
  addPart();

  return bdParts.join("");
}

const MAX_BD_SEGMENTS = 9;
export function breakdownString(segs: number[]): string {
  if (segs.length <= MAX_BD_SEGMENTS) {
    return breakdownStringFull(segs);
  }
  let bd: string | null = null;
  for (let simplifyLevel = 1; simplifyLevel < 4; simplifyLevel++) {
    bd = breakdownStringSimplified(segs, simplifyLevel, MAX_BD_SEGMENTS);
    if (bd !== null) break;
  }
  if (bd === null) {
    let total = segs.filter((s) => s > 0).reduce((accum, s) => accum + s, 0);
    bd = total.toString() + " total";
  }
  return bd;
}

export class ChartAnalyzer {
  sim: Simfile;
  chart: Chart;
  timingData: TimingData;
  engine: TimingEngine;

  private jumpsMode: JumpsHandlingMode;

  private hittableRows?: number[];
  private noteTimes?: number[];
  private npsSeq?: number[];
  private notesPerMeasure?: number[];

  constructor(sim: Simfile, chart: Chart, jumpsMode: JumpsHandlingMode) {
    this.sim = sim;
    this.chart = chart;
    this.jumpsMode = jumpsMode;
    this.timingData = new TimingData(sim, chart);
    this.engine = new TimingEngine(this.timingData);
  }

  getJumpsMode() {
    return this.jumpsMode;
  }

  setJumpsMode(jumpsMode: JumpsHandlingMode) {
    if (this.jumpsMode !== jumpsMode) {
      // invalidate cached sequences that depend on jumpsMode
      this.npsSeq = undefined;
      this.notesPerMeasure = undefined;

      this.jumpsMode = jumpsMode;
    }
  }

  getHittableRows() {
    if (this.hittableRows) return this.hittableRows;

    function* generator(notes: Iterable<Note>, engine: TimingEngine) {
      for (const note of notes) {
        const t = note.noteType;
        if (
          (t === NoteTypes.TAP ||
            t === NoteTypes.HOLD_HEAD ||
            t === NoteTypes.ROLL_HEAD) &&
          engine.hittable(note.row)
        )
          yield note.row;
      }
    }

    this.hittableRows = [...generator(this.chart.notesIterator(), this.engine)];
    return this.hittableRows;
  }

  getNoteTimes(): number[] {
    if (!this.noteTimes) {
      this.noteTimes = this.getHittableRows().map((row) =>
        this.engine.timeAt(row),
      );
    }
    return this.noteTimes;
  }

  private *groupSameValues(vals: Iterable<number>) {
    let curVal: number | null = null;
    let curValCount = 1;
    for (const val of vals) {
      if (this.jumpsMode === "individual") {
        // count each value individually
        yield val;
      } else {
        if (curVal === val) {
          curValCount++;
        } else {
          curVal = val;
          curValCount = 1;
        }
        // jumps mode -> count 1st and 2nd occurrences
        // brackets mode -> count 1st and 3rd occurrences
        let doYield = curValCount === 1;
        if (this.jumpsMode === "jumps") doYield ||= curValCount === 2;
        else if (this.jumpsMode === "brackets") doYield ||= curValCount === 3;

        if (doYield) yield val;
      }
    }
  }

  getNPSSeq(rateMod: number = 1): number[] {
    if (rateMod === 1) {
      if (!this.npsSeq) {
        this.npsSeq = [
          ...npsSeqIterator(this.groupSameValues(this.getNoteTimes())),
        ];
      }
      return this.npsSeq;
    }

    function* generator(iter: Iterable<number>) {
      for (const t of iter) yield t / rateMod;
    }

    return [
      ...npsSeqIterator(generator(this.groupSameValues(this.getNoteTimes()))),
    ];
  }

  getNotesPerMeasure(): number[] {
    if (this.notesPerMeasure !== undefined) return this.notesPerMeasure;

    this.notesPerMeasure = [];
    let curMeasureStart = 0;
    let curMeasureCount = 0;
    for (const row of this.groupSameValues(this.getHittableRows())) {
      if (row >= curMeasureStart + ROWS_PER_MEASURE) {
        this.notesPerMeasure.push(curMeasureCount);
        curMeasureCount = 0;
        curMeasureStart += ROWS_PER_MEASURE;
        while (row - curMeasureStart >= ROWS_PER_MEASURE) {
          this.notesPerMeasure.push(0);
          curMeasureStart += ROWS_PER_MEASURE;
        }
      }
      curMeasureCount++;
    }
    this.notesPerMeasure.push(curMeasureCount);
    return this.notesPerMeasure;
  }

  getStreamInfo() {
    const npmSeq = this.getNotesPerMeasure();
    const numMeasures = npmSeq.length;

    const measureBpms = [];
    let startTime = this.engine.timeAt(0);
    for (let i = 0; i < numMeasures; i++) {
      const endRow = (i + 1) * ROWS_PER_MEASURE;
      const endTime = this.engine.timeAt(endRow);
      const measureLen = endTime - startTime;
      if (measureLen !== 0) {
        measureBpms.push(240 / measureLen);
      } else {
        measureBpms.push(0); // fallback to avoid division by 0
      }
      startTime = endTime;
    }

    const quants = [32, 24, 20, 16, 12, 8, 4, 2, 1];
    const streamRuns: Record<number, StreamRun[]> = {};
    const minBpm: Record<number, number | null> = {};
    const maxBpm: Record<number, number | null> = {};
    const accumBpm: Record<number, number> = {};
    for (const q of quants) {
      streamRuns[q] = [];
      minBpm[q] = null;
      maxBpm[q] = null;
      accumBpm[q] = 0;
    }
    for (let i = 0; i < numMeasures; i++) {
      const count = npmSeq[i];
      const bpm = measureBpms[i];
      for (const q of quants) {
        if (count >= q) {
          // this is a stream measure
          const runs = streamRuns[q];
          const lastRun: StreamRun | undefined = runs[runs.length - 1];
          if (lastRun && lastRun.start + lastRun.len === i) {
            lastRun.len++;
          } else {
            runs.push({ start: i, len: 1 });
          }

          if (minBpm[q] === null) {
            minBpm[q] = maxBpm[q] = bpm;
          } else {
            minBpm[q] = Math.min(minBpm[q], bpm);
            maxBpm[q] = Math.max(maxBpm[q]!, bpm);
          }
          accumBpm[q] += bpm;
        }
      }
    }

    let q = 32;
    let totalStream = streamRuns[q].reduce((accum, run) => accum + run.len, 0);
    for (const testQ of quants.slice(1)) {
      const testTotalStream = streamRuns[testQ].reduce(
        (accum, run) => accum + run.len,
        0,
      );
      // only use lower quant if significant improvement is found
      if (testTotalStream > 0 && totalStream / testTotalStream < 0.5) {
        q = testQ;
        totalStream = testTotalStream;
      }
      const entireChartDensity = totalStream / numMeasures;
      // only consider going below 16ths if there's no 16th stream at all
      const threshold = testQ === 16 ? 0 : 0.1;
      if (entireChartDensity > threshold) break;
    }

    const runs = streamRuns[q];
    let adjustedMeasureCount = 0;
    if (runs.length > 0) {
      const lastRun = runs[runs.length - 1];
      adjustedMeasureCount = lastRun.start + lastRun.len - runs[0].start;
    }
    const totalBreak = adjustedMeasureCount - totalStream;

    return {
      runs,
      quant: q,
      totalStream,
      totalBreak,
      bpms: [minBpm[q], maxBpm[q]],
      avgBpm: totalStream > 0 ? accumBpm[q] / totalStream : null,
    };
  }

  getDensityGraph(): [number, number][] {
    // ported from itgdb
    const npsData: [number, number][] = [];

    function appendPoint(time: number, nps: number) {
      // if last 2 points in graph have same nps,
      // just move the 2nd one to current measure time
      // (idea stolen from simply love's code)
      if (
        npsData.length >= 2 &&
        Math.abs(nps - npsData[npsData.length - 1][1]) < 1e-9 &&
        Math.abs(nps - npsData[npsData.length - 2][1]) < 1e-9
      ) {
        npsData[npsData.length - 1][0] = time;
      } else {
        npsData.push([time, nps]);
      }
    }

    // get nps for each measure, assemble final graph data
    const npmSeq = this.getNotesPerMeasure();
    let startTime = this.engine.timeAt(0);
    let deferredCount = 0; // count of notes not put in the graph yet
    npmSeq.forEach((count, i) => {
      const endBeat = (i + 1) * 4;
      const endTime = this.engine.timeAt(beatToRow(endBeat));
      const measureLen = endTime - startTime;

      // if the measure is too short, defer calculating the nps until we
      // accumulate more time from future measures
      if (measureLen > 0.12) {
        // calculate nps, including notes deferred from prev. skipped measures
        const nps = (count + deferredCount) / measureLen;
        deferredCount = 0;
        appendPoint(startTime, nps);
        startTime = endTime;
      } else {
        deferredCount += count;
      }
    });

    // add 0 nps point right after last measure
    const lastBeat = npmSeq.length * 4;
    const lastTime = this.engine.timeAt(beatToRow(lastBeat));
    appendPoint(lastTime, 0);

    // ehh i don't feel like bothering to put another 0 nps point right
    // at the end of the song

    return npsData;
  }

  getDiffStr() {
    return ["Novice", "Easy", "Medium", "Hard", "Expert", "Edit"][
      this.chart.difficulty
    ];
  }
}
