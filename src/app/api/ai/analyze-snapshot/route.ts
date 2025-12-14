import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `Du är en erfaren skolanalytiker och pedagogisk rådgivare för Järva Gymnasium i Stockholm. Din uppgift är att analysera betygsdata från en snapshot och producera en insiktsfull rapport på svenska.

## Din roll
- Skriv professionellt men tillgängligt för rektorer, lärare och studievägledare
- Var konstruktiv och lösningsorienterad, inte dömande
- Lyft fram både framgångar och utmaningar
- Ge konkreta, genomförbara rekommendationer

## Analysstruktur

### DEL 1: SAMMANFATTNING

**Nyckeltal**
Presentera följande i en tydlig lista:
- Totalt antal elever med registrerade betyg
- Antal F-betyg (och F-varningar separat om data finns)
- Godkänt-andel (% som inte har F)
- Antal förbättringar (om data finns)

**Övergripande bedömning**
Ge en kort (2-3 meningar) sammanfattande bedömning av läget. Använd ett av följande:
- 🟢 POSITIVT LÄGE: om godkänt-andel > 85% och situationen ser bra ut
- 🟡 BEHÖVER UPPMÄRKSAMHET: om godkänt-andel 70-85% eller det finns oroande mönster
- 🔴 KRITISKT LÄGE: om godkänt-andel < 70% eller många elever med 3+ F

**Styrkor** (3 punkter)
Identifiera vad som fungerar bra baserat på datan.

**Utmaningar** (3 punkter)
Identifiera de största problemområdena.

### DEL 2: DJUPANALYS

**Klassanalys**
- Rangordna klasser efter andel F-betyg (visa topp 3 bästa och topp 3 sämsta)
- Lyft fram klassen med bäst resultat
- Identifiera klassen med störst utmaning

**Kursanalys**
- Lista de 5 kurser med flest F-betyg
- Analysera om det finns mönster (t.ex. matematik, språk, karaktärsämnen)
- Notera kurser med anmärkningsvärt få F (framgångsfaktorer?)

**Elever i riskzonen**
- Hur många elever har 1 F? 2 F? 3+ F?
- Finns det klassvis koncentration av elever i riskzonen?

**Förbättringar och positiva trender**
- Lyft fram förbättringar om data finns
- Identifiera mönster i vilka kurser/klasser som visar framsteg

### DEL 3: REKOMMENDATIONER

Ge 3-5 konkreta åtgärdsförslag baserade på analysen:
1. [Akut åtgärd om kritiskt läge finns]
2. [Förebyggande insats]
3. [Långsiktig strategi]

Avsluta med en kort uppmuntrande mening om vägen framåt.

## Formatering
- Använd tydliga rubriker med ### för huvudrubriker och #### för underrubriker
- Använd punktlistor för läsbarhet
- Inkludera relevanta siffror men överbelasta inte med data
- Skriv på korrekt svenska
- Använd emoji sparsamt för visuell tydlighet (🟢🟡🔴 för status, ✅⚠️ för punkter)

## Viktigt
- Nämn ALDRIG enskilda elevers namn i analysen (integritetsskydd)
- Fokusera på mönster och aggregerad data
- Var ödmjuk om data är begränsad - säg "baserat på tillgänglig data"
- Håll analysen koncis men innehållsrik (ca 800-1200 ord)`;

interface SnapshotData {
  name: string;
  quarterName: string;
  snapshotDate: string;
  stats: {
    totalStudents: number;
    totalGrades: number;
    totalFGrades: number;
    totalFWarnings: number;
    passRate: number;
    totalImprovements?: number;
  };
  classBreakdown: Array<{
    className: string;
    studentCount: number;
    fCount: number;
    fWarningCount: number;
  }>;
  courseBreakdown: Array<{
    courseCode: string;
    courseName: string;
    fCount: number;
    fWarningCount: number;
  }>;
  studentsAtRisk: {
    with1F: number;
    with2F: number;
    with3PlusF: number;
  };
}

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const snapshotData: SnapshotData = body.snapshotData;

    if (!snapshotData) {
      return NextResponse.json(
        { error: 'Missing snapshot data' },
        { status: 400 }
      );
    }

    // Build the user prompt with the actual data
    const userPrompt = buildUserPrompt(snapshotData);

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate analysis' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const analysis = data.choices[0]?.message?.content;

    if (!analysis) {
      return NextResponse.json(
        { error: 'No analysis generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Error generating analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildUserPrompt(data: SnapshotData): string {
  const classTable = data.classBreakdown
    .sort((a, b) => (b.fCount / Math.max(b.studentCount, 1)) - (a.fCount / Math.max(a.studentCount, 1)))
    .slice(0, 15)
    .map(c => `- ${c.className}: ${c.studentCount} elever, ${c.fCount} F-betyg, ${c.fWarningCount} F-varningar`)
    .join('\n');

  const courseTable = data.courseBreakdown
    .sort((a, b) => b.fCount - a.fCount)
    .slice(0, 15)
    .map(c => `- ${c.courseCode} (${c.courseName}): ${c.fCount} F-betyg, ${c.fWarningCount} F-varningar`)
    .join('\n');

  return `Analysera följande snapshot-data från Järva Gymnasium:

## Grundinformation
- **Snapshot:** ${data.name}
- **Kvartal:** ${data.quarterName}
- **Datum:** ${data.snapshotDate}

## Övergripande statistik
- Totalt antal elever med betyg: ${data.stats.totalStudents}
- Totalt antal registrerade betyg: ${data.stats.totalGrades}
- Antal F-betyg: ${data.stats.totalFGrades}
- Antal F-varningar: ${data.stats.totalFWarnings}
- Godkänt-andel: ${data.stats.passRate.toFixed(1)}%
${data.stats.totalImprovements !== undefined ? `- Antal förbättringar (F → godkänt): ${data.stats.totalImprovements}` : ''}

## Elever i riskzonen
- Elever med 1 F-betyg: ${data.studentsAtRisk.with1F}
- Elever med 2 F-betyg: ${data.studentsAtRisk.with2F}
- Elever med 3+ F-betyg: ${data.studentsAtRisk.with3PlusF}

## Fördelning per klass (sorterat efter andel F)
${classTable}

## Fördelning per kurs (sorterat efter antal F)
${courseTable}

Producera nu en komplett analysrapport enligt strukturen i dina instruktioner.`;
}

