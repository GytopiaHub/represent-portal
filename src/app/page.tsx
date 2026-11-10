import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <Image src="/logo.svg" alt="RepresENT" width={72} height={72} priority />
      <h1 className="text-3xl font-bold">RepresENT Portal</h1>
      <p className="text-muted-foreground">Rebuilding — features are coming back one at a time.</p>
    </main>
  );
}
