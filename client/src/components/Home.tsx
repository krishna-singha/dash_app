import { useEffect, useState } from "react";
import VideoCard from "./VideoCard";

interface HomeProps {
  onSelectVideo: (videoId: string) => void;
}

export default function Home({ onSelectVideo }: HomeProps) {
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/videos")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setVideoIds(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load videos:", err);
        setError("Unable to connect to video server");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="mb-10 text-center">
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Choose a Video to Stream
        </h1>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center gap-3 py-16 text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <span className="text-sm font-medium">Scanning video library...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-6 py-4 text-center">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && videoIds.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-400">
          <p className="text-sm">No DASH video streams found under videos/ directory.</p>
        </div>
      )}

      {/* Video Cards Grid */}
      {!loading && !error && videoIds.length > 0 && (
        <div className="flex flex-wrap justify-center gap-6">
          {videoIds.map((id) => (
            <VideoCard key={id} id={id} onSelect={onSelectVideo} />
          ))}
        </div>
      )}
    </div>
  );
}