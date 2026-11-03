import ColorCounters from "./ui/color-counters";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <ColorCounters />
    </main>
  );
}
