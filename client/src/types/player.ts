export type QualityLevel = {
  id: string;
  bitrate: number;
  width?: number;
  height?: number;
  label: string;
};

export interface PlayerStats {
  resolution: string;
  quality: string;
  bitrate: string;
  throughput: string;
  bufferAhead: string;
  qualityMode: string;
  droppedFrames: string;
  segmentFetch: string;
}

export interface VideoResponse {
  id?: string;
  name?: string;
  title: string;
  manifestUrl: string;
}