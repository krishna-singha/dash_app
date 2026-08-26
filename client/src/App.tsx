import { useState } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./components/Home";
import DashPlayer from "./components/DashPlayer";

function App() {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  return (
    <main className="min-h-screen flex flex-col bg-[#030712] text-slate-100">
      <Navbar onGoHome={() => setSelectedVideoId(null)} />
      <div className="flex-1">
        {selectedVideoId ? (
          <DashPlayer
            videoId={selectedVideoId}
            onBack={() => setSelectedVideoId(null)}
          />
        ) : (
          <Home onSelectVideo={(id) => setSelectedVideoId(id)} />
        )}
      </div>
      <Footer />
    </main>
  );
}

export default App;
