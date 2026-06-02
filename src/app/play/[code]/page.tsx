export default function PlayPage({ params }: { params: { code: string } }) {
  return (
    <main className="flex-1 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-400 text-lg">Player screen for room</p>
        <p className="text-5xl font-black text-purple-400 mt-2">{params.code}</p>
        <p className="text-gray-500 mt-4 text-sm">Coming in M2…</p>
      </div>
    </main>
  );
}
