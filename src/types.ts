export interface DataPoint {
  name: string;
  pack: string;
  hash: string;
  meter: number | null;
  bpm: number;
  totalStream: number;
  streamDensity: number;
  minBpm: number;
  maxBpm: number;
  segments: number[];
  densityGraph: [number, number][];
  isCustom?: boolean;
}
