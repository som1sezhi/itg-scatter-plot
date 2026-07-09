export interface DataPoint {
  name: string;
  hash: string;
  meter: number;
  bpm: number;
  totalStream: number;
  streamDensity: number;
  segments: number[];
}
