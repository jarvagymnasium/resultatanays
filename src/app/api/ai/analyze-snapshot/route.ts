import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
Du är en expert på pedagogisk dataanalys för svenska gymnasieskolor. Din uppgift är att analysera en "snapshot" av betygsläget.

Analysen ska vara professionell, insiktsfull och direkt användbar för rektorer och lärare.
Fokusera på trender, riskgrupper och framsteg.

VIKTIGT OM FORMATERING:
- Svaret ska vara formaterat med Markdown.
- Använd INTE tabeller (de renderas dåligt i PDF).
- Använd punktlistor och tydliga rubriker (###).
- Undvik emojis i den löpande texten.
- Skriv "F -> godkänt" istället för pilar eller specialtecken.

VIKTIGT OM DATA:
- Ignorera elever som helt saknar betyg (null/undefined) i bedömningen av prestanda. "Inga betyg" betyder oftast att kursen inte startat eller att eleven är ny, inte att de presterar dåligt.
- Fokusera på de faktiska betygen (A-F) och F-varningar.
- Jämför kvantitativa data (t.ex. andel F) mot totala antalet *bedömda* elever, inte totala antalet elever i registret, för att få en rättvis bild.
`;

export async function POST(req: Request) {
  try {
    const { snapshotData } = await req.json();

    if (!snapshotData) {
      return NextResponse.json(
        { error: 'Ingen snapshot-data tillhandahölls' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Bygg en prompt baserat på datan
    const userPrompt = `
      Här är data för en snapshot: "${snapshotData.name}" (${snapshotData.quarterName}).
      Datum: ${snapshotData.snapshotDate}

      STATISTIK:
      - Totalt antal elever i registret: ${snapshotData.stats.totalStudentsAll}
      - Antal elever med minst ett betyg: ${snapshotData.stats.totalStudents} (Täckningsgrad: ${snapshotData.stats.coveragePct.toFixed(1)}%)
      - Totalt antal satta betyg: ${snapshotData.stats.totalGrades}
      - Antal F-betyg: ${snapshotData.stats.totalFGrades}
      - Antal F-varningar: ${snapshotData.stats.totalFWarnings}
      - Godkännandegrad (av satta betyg): ${snapshotData.stats.passRate.toFixed(1)}%
      - Antal förbättringar (F -> E-A) detta kvartal: ${snapshotData.stats.totalImprovements}

      RISKGRUPPER (Elever med flera F):
      - 1 F: ${snapshotData.studentsAtRisk.with1F} elever
      - 2 F: ${snapshotData.studentsAtRisk.with2F} elever
      - 3 eller fler F: ${snapshotData.studentsAtRisk.with3PlusF} elever

      KLASSER (Topplista sämst resultat, baserat på elever med betyg):
      ${snapshotData.classBreakdown.slice(0, 5).map((c: any) => 
        `- ${c.className}: ${c.fCount} F, ${c.fWarningCount} varningar (${c.studentCount} bedömda elever)`
      ).join('\n')}

      KURSER (Topplista flest F):
      ${snapshotData.courseBreakdown.slice(0, 5).map((c: any) => 
        `- ${c.courseCode}: ${c.fCount} F, ${c.fWarningCount} varningar`
      ).join('\n')}

      Vänligen ge en sammanfattande analys på ca 300-400 ord.
      Strukturera analysen med följande rubriker:
      ### Sammanfattning
      ### Positiva trender
      ### Utmaningar och risker
      ### Rekommendationer
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Eller gpt-4o-mini för snabbare/billigare, men 4o är bäst för analys
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500, 
    });

    const analysis = response.choices[0].message.content;

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    return NextResponse.json(
      { error: error.message || 'Misslyckades med att generera analys' },
      { status: 500 }
    );
  }
}
