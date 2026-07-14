export interface DataPoint {
  name: string;
  hash: string;
  meter: number | null;
  bpm: number;
  totalStream: number;
  streamDensity: number;
  segments: number[];
  isCustom?: boolean;
}
