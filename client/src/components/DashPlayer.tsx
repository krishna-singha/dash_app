import { useEffect, useRef, useState } from "react";
import * as dashjs from "dashjs";
import type { QualityLevel, PlayerStats, VideoResponse } from "../types/player";


interface DashPlayerProps {
  videoId?: string;
  onBack?: () => void;
}

type VideoElementWithWebkitMetrics = HTMLVideoElement & {
  webkitDroppedFrameCount?: number;
};

export default function DashPlayer({ videoId, onBack }: DashPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const lastSegmentTimeRef = useRef<number | null>(null);
  const lastMeasuredThroughputRef = useRef<number>(0);

  const [videoTitle, setVideoTitle] = useState("Loading Video...");
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQualityId, setSelectedQualityId] = useState<string>("auto");
  const [currentPlayingQuality, setCurrentPlayingQuality] = useState("");

  const [stats, setStats] = useState<PlayerStats>({
    resolution: "0 x 0",
    quality: "0p",
    bitrate: "0.00 Mbps",
    throughput: "Measuring...",
    bufferAhead: "0.0s",
    qualityMode: "Auto",
    droppedFrames: "0 / 0 frames",
    segmentFetch: "No requests yet",
  });

  useEffect(() => {
    let isMounted = true;
    let player: dashjs.MediaPlayerClass | null = null;
    let interval: number | null = null;

    const initStream = async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        const res = await fetch(`/api/video/${videoId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch video: ${res.status} ${res.statusText}`);
        }
        const data: VideoResponse = await res.json();
        if (isMounted) {
          if (data.title) setVideoTitle(data.title);
        }

        if (!isMounted || !videoRef.current) return;

        player = dashjs.MediaPlayer().create();
        playerRef.current = player;

        const streamUrl = data.manifestUrl;
        const populateQualityLevels = () => {
          if (!player) return;
          try {
            const reps = player.getRepresentationsByType("video") || [];
            if (reps.length > 0) {
              const levels: QualityLevel[] = reps.map((rep) => {
                const kbps = rep.bitrateInKbit ?? (rep.bandwidth ? Math.round(rep.bandwidth / 1000) : 0);
                return {
                  id: rep.id,
                  bitrate: kbps,
                  width: rep.width,
                  height: rep.height,
                  label: rep.height
                    ? `${rep.height}p`
                    : kbps >= 1000
                      ? `${(kbps / 1000).toFixed(1)} Mbps`
                      : `${kbps} kbps`,
                };
              });
              setQualityLevels(levels);
            }
          } catch (e) {
            console.warn("Could not retrieve representations:", e);
          }
        };

        // Populate quality levels when stream initializes
        player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, populateQualityLevels);
        player.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, populateQualityLevels);

        // Track chunk fetch completions and calculate throughput
        player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, (e: dashjs.FragmentLoadingCompletedEvent) => {
          lastSegmentTimeRef.current = Date.now();
          const bytes = e.request.bytesLoaded || e.request.bytesTotal || 0;
          const startTime = e.request.startDate.getTime();
          const endTime = e.request.requestEndDate?.getTime() ?? Date.now();
          if (bytes > 0 && startTime > 0 && endTime > startTime) {
            const durationSec = (endTime - startTime) / 1000;
            const kbps = (bytes * 8) / 1000 / durationSec;
            if (Number.isFinite(kbps) && kbps > 0) {
              lastMeasuredThroughputRef.current = kbps;
            }
          }
        });

        // Track active playback quality changes
        player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e: dashjs.QualityChangeRenderedEvent) => {
          if (e.mediaType === "video" && e.newRepresentation) {
            const rep = e.newRepresentation;
            const label = rep.height
              ? `${rep.height}p`
              : rep.bitrateInKbit
                ? `${Math.round(rep.bitrateInKbit)} kbps`
                : "";
            if (label) setCurrentPlayingQuality(label);
          }
        });

        player.initialize(videoRef.current, streamUrl, true);

        // Poll live metrics every 500ms
        interval = window.setInterval(() => {
          const video = videoRef.current;
          if (!player || !video) return;

          let activeRep: dashjs.Representation | null = null;
          try {
            activeRep = player.getCurrentRepresentationForType("video");
          } catch {
            // Stream not ready yet
          }

          if (activeRep) {
            const activeLabel = activeRep.height
              ? `${activeRep.height}p`
              : activeRep.bitrateInKbit
                ? `${Math.round(activeRep.bitrateInKbit)} kbps`
                : "";
            if (activeLabel) setCurrentPlayingQuality(activeLabel);
          }

          // 1. Quality Mode
          let isAuto = true;
          try {
            const settings = player.getSettings();
            isAuto = settings.streaming?.abr?.autoSwitchBitrate?.video ?? true;
          } catch {
            // Ignore
          }
          const qualityMode = isAuto ? "Auto" : "Manual";

          // 2. Resolution
          let resolution = "0 x 0";
          if (activeRep?.width && activeRep?.height) {
            resolution = `${activeRep.width} x ${activeRep.height}`;
          } else if (video.videoWidth > 0 && video.videoHeight > 0) {
            resolution = `${video.videoWidth} x ${video.videoHeight}`;
          }

          // 3. Quality
          let quality = "0p";
          if (activeRep?.height) {
            quality = `${activeRep.height}p`;
          }

          // 4. Encoded Video Bitrate
          let bitrate = "0.00 Mbps";
          if (activeRep) {
            const kbps = activeRep.bitrateInKbit ?? (activeRep.bandwidth ? activeRep.bandwidth / 1000 : 0);
            if (kbps >= 1000) {
              bitrate = `${(kbps / 1000).toFixed(2)} Mbps`;
            } else if (kbps > 0) {
              bitrate = `${Math.round(kbps)} kbps`;
            }
          }

          // 5. Realtime Throughput
          let throughputKbps = 0;
          try {
            throughputKbps = player.getAverageThroughput("video") || 0;
          } catch {
            // Ignore if unready
          }

          if (!Number.isFinite(throughputKbps) || throughputKbps <= 0) {
            throughputKbps = lastMeasuredThroughputRef.current;
          } else {
            lastMeasuredThroughputRef.current = throughputKbps;
          }

          let throughput = "Measuring...";
          if (throughputKbps > 0) {
            if (throughputKbps >= 1000) {
              throughput = `${(throughputKbps / 1000).toFixed(2)} Mbps`;
            } else {
              throughput = `${Math.round(throughputKbps)} kbps`;
            }
          }

          // 6. Buffer Ahead
          let bufferLen = 0;
          try {
            bufferLen = player.getBufferLength("video") || 0;
          } catch {
            // Ignore
          }
          const bufferAhead = Number.isFinite(bufferLen)
            ? `${Math.max(0, bufferLen).toFixed(1)}s`
            : "0.0s";

          // 7. Dropped Frames
          let droppedFrames = "0 / 0 frames";
          if (typeof video.getVideoPlaybackQuality === "function") {
            const q = video.getVideoPlaybackQuality();
            droppedFrames = `${q.droppedVideoFrames} / ${q.totalVideoFrames} frames`;
          } else {
            const videoWithWebkitMetrics = video as VideoElementWithWebkitMetrics;
            if (videoWithWebkitMetrics.webkitDroppedFrameCount !== undefined) {
              droppedFrames = `${videoWithWebkitMetrics.webkitDroppedFrameCount} dropped`;
            }
          }

          // 8. Segment Fetch Delta
          let segmentFetch = "No requests yet";
          if (lastSegmentTimeRef.current !== null) {
            const secAgo = Math.floor((Date.now() - lastSegmentTimeRef.current) / 1000);
            segmentFetch = secAgo < 3
              ? "Just now"
              : secAgo < 60
                ? `${secAgo}s ago`
                : `${Math.floor(secAgo / 60)}m ${secAgo % 60}s ago`;
          }

          setStats({
            qualityMode,
            resolution,
            quality,
            bitrate,
            throughput,
            bufferAhead,
            droppedFrames,
            segmentFetch,
          });
        }, 500);
      } catch (err) {
        console.error("Failed to fetch video from FastAPI server:", err);
        return;
      }
    };

    initStream();

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
      if (player) {
        player.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  const handleQualitySelect = (repId: string) => {
    setSelectedQualityId(repId);
    const player = playerRef.current;
    if (!player) return;

    if (repId === "auto") {
      // Re-enable Auto ABR
      player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: { video: true },
          },
        },
      });
    } else {
      // Disable Auto ABR
      player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: { video: false },
          },
        },
      });

      // Set manual representation
      player.setRepresentationForTypeById("video", repId, true);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700 hover:text-white cursor-pointer"
              >
                ← Back
              </button>
            )}
            <h2 className="text-xl font-bold tracking-tight text-white">{videoTitle}</h2>
          </div>
        </div>

        <div className="aspect-video w-full overflow-hidden rounded-xl bg-gray-900 shadow-xl border border-gray-600">
          <video
            ref={videoRef}
            controls
            playsInline
            className="block h-full w-full bg-black object-contain"
          />
        </div>

        {/* Quality Controls */}
        <div className="rounded-xl border border-slate-800/80 bg-[#0b0f19] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-white">Quality Selection</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleQualitySelect("auto")}
              className={`cursor-pointer rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${selectedQualityId === "auto"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
            >
              Auto {currentPlayingQuality ? `(${currentPlayingQuality})` : ""}
            </button>
            {qualityLevels.map((level: QualityLevel) => {
              const isSelected = selectedQualityId === level.id;
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => handleQualitySelect(level.id)}
                  className={`cursor-pointer rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${isSelected
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar Metrics */}
      <aside className="w-100 rounded-xl border border-white/10 bg-[#0b0f19] p-4 text-slate-100">
        <h3 className="mb-2 text-white">Telemetry</h3>

        {/* Quality Mode */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <div>
              <div className="text-sm font-medium">Quality Mode</div>
              <div className="text-xs text-slate-400">ABR algorithm status</div>
            </div>
          </div>
          <span className="font-mono text-sm font-semibold">{stats.qualityMode}</span>
        </div>

        {/* Resolution */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div>
              <div className="text-sm font-medium">Resolution</div>
              <div className="text-xs text-slate-400">{stats.resolution.replace("x", "x")} px</div>
            </div>
          </div>
          <span className="font-mono text-sm font-semibold">{stats.quality}</span>
        </div>

        {/* Video Bitrate */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <div className="text-sm font-medium">Video Bitrate</div>
              <div className="text-xs text-slate-400">Active representation target</div>
            </div>
          </div>
          <span className="font-mono text-sm font-semibold">{stats.bitrate}</span>
        </div>

        {/* Throughput */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="text-sm font-medium">Throughput</div>
              <div className="text-xs text-slate-400">Measured network speed</div>
            </div>
          </div>
          <span className="font-mono text-sm font-semibold">{stats.throughput}</span>
        </div>

        {/* Buffer Ahead */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div>
              <div className="text-sm font-medium">Buffer Ahead</div>
              <div className="text-xs text-slate-400">MediaSource buffer duration</div>
            </div>
          </div>
          <span className="font-mono text-sm font-semibold">{stats.bufferAhead}</span>
        </div>

        {/* Dropped Frames */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <div>
              <div className="text-sm font-medium">Dropped Frames</div>
              <div className="text-xs text-slate-400">Decoded frame loss metric</div>
            </div>
          </div>
          <span className="font-mono text-sm font-semibold">{stats.droppedFrames}</span>
        </div>

        {/* Segment Fetch */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <div className="text-sm font-medium">Segment Fetch</div>
              <div className="text-xs text-slate-400">Recent HTTP chunk request</div>
            </div>
          </div>
          <span className="font-mono text-sm font-semibold">{stats.segmentFetch}</span>
        </div>
      </aside>
    </div>
  );
}