interface NavbarProps {
  onGoHome?: () => void;
}

export default function Navbar({ onGoHome }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#030712]/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onGoHome}
          className="text-xl font-bold tracking-tight text-slate-100 hover:opacity-90 cursor-pointer"
        >
          DASH<span className="text-cyan-400">Player</span>
        </button>
      </div>
    </header>
  );
}