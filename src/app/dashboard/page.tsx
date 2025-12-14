import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#1a1a2e] text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-3xl font-bold">🔜 Ny Dashboard</h1>
        <p className="text-gray-400 leading-relaxed">
          Här kommer den omstrukturerade dashboarden att byggas – med React-komponenter,
          server-side rendering, och möjlighet att ansluta till ert elevdatabas-API samt AI-tjänster.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 text-[#43bde3] hover:underline"
        >
          ← Tillbaka till startsidan
        </Link>
      </div>
    </main>
  );
}

