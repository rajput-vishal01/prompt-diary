import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">
        Prompt<span className="text-accent">Diary</span>
      </h1>
      <p className="max-w-md text-center text-dim">
        A password-manager-style vault for your best AI prompts. Save from any
        page, organize with folders and tags, sync across devices, share with
        your team — or the world.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:brightness-110"
        >
          Sign in
        </Link>
        <Link
          href="/gallery"
          className="rounded-lg border border-line bg-raised px-5 py-2.5 font-semibold hover:bg-hover"
        >
          Browse public prompts
        </Link>
      </div>
    </main>
  );
}
