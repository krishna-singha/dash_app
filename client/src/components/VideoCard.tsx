import { useState } from "react";

interface VideoCardProps {
  id: string;
  onSelect: (id: string) => void;
  thumbnailUrl?: string;
}

const FALLBACK_THUMBNAIL =
  "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=800&auto=format&fit=crop";

export default function VideoCard({ id, onSelect, thumbnailUrl }: VideoCardProps) {
  const [imgSrc, setImgSrc] = useState(
    thumbnailUrl || `/videos/${id}/thumbnail.jpg`
  );

  const title = id
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      onClick={() => onSelect(id)}
      className="group relative flex w-72 cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/10"
    >
      {/* Video Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950">
        <img
          src={imgSrc}
          alt={title}
          onError={() => setImgSrc(FALLBACK_THUMBNAIL)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Hover Overlay Play Button */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-white shadow-lg shadow-cyan-500/40 transition-transform duration-300 group-hover:scale-110">
            <svg className="ml-0.5 h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        <span className="absolute bottom-2 right-2 rounded border border-cyan-400/20 bg-black/80 px-2 py-0.5 font-mono text-[10px] text-cyan-400">
          MPEG-DASH
        </span>
      </div>

      {/* Info Footer */}
      <div className="mt-3 flex items-center justify-between px-1">
        <div>
          <h3 className="font-semibold text-slate-100 transition-colors group-hover:text-cyan-400">
            {title}
          </h3>
          <p className="font-mono text-xs text-slate-400">ID: {id}</p>
        </div>
        <span className="text-xs text-slate-400 transition-transform group-hover:translate-x-1">
          Play →
        </span>
      </div>
    </div>
  );
}