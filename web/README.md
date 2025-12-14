# Järva Gymnasium – Resultatanalys (Next.js)

En fullständig React/Next.js-omskrivning av resultatanalysverktyget med alla funktioner från den ursprungliga `index.html`.

---

## 🚀 Snabbstart

```bash
cd web
npm install      # Installera beroenden
npm run dev      # Starta dev-server (http://localhost:3000)
```

### Produktionsbygge

```bash
npm run build
npm start
```

---

## 📁 Projektstruktur

```
web/
├── public/
│   └── legacy/
│       └── index.html        # Ursprungliga appen (backup)
├── src/
│   ├── app/
│   │   ├── page.tsx          # Huvudsida (login/dashboard)
│   │   ├── layout.tsx        # Root layout
│   │   ├── globals.css       # Globala stilar (Järva-tema)
│   │   ├── dashboard/        # Dashboard placeholder
│   │   └── api/              # API-routes
│   │       ├── health/       # Hälsokoll
│   │       ├── students/     # Elevdatabas-stub
│   │       └── ai/           # AI-funktioner stub
│   ├── components/
│   │   ├── LoginScreen.tsx   # Inloggningsskärm
│   │   ├── Dashboard.tsx     # Huvuddashboard
│   │   ├── Header.tsx        # Header med tabs
│   │   ├── modals/
│   │   │   └── StudentDetailModal.tsx
│   │   └── tabs/
│   │       ├── WarningsTab.tsx    # F-varningar + grafer
│   │       ├── ProgressTab.tsx    # Betygsutveckling
│   │       ├── ClassesTab.tsx     # Klasser CRUD
│   │       ├── CoursesTab.tsx     # Kurser CRUD + favoriter
│   │       ├── StudentsTab.tsx    # Elever CRUD
│   │       ├── GradesTab.tsx      # Betygsättning
│   │       ├── QuartersTab.tsx    # Kvartalhantering
│   │       ├── ArchiveTab.tsx     # Arkiv
│   │       ├── CompareTab.tsx     # Jämförelser
│   │       └── SnapshotsTab.tsx   # Snapshots
│   └── lib/
│       ├── types.ts          # TypeScript-typer
│       ├── supabase.ts       # Supabase-klient
│       ├── store.ts          # Zustand state management
│       └── exports.ts        # PDF/Excel export
├── package.json
└── README.md
```

---

## ✨ Funktioner

### Alla ursprungliga funktioner bevarade:

- **🔐 Autentisering** – Supabase Auth med rollbaserad åtkomst (admin/teacher/analyst)
- **⚠️ F-varningar** – Dashboard med statistik, filter och Chart.js-grafer
- **📈 Utveckling** – Spårning av betygsförbättringar
- **🏫 Klasser** – CRUD med kurskopplingar
- **📚 Kurser** – CRUD med favoriter och avancerad filtrering
- **👥 Elever** – CRUD med klassplacering
- **📝 Betygsättning** – Betyg och varningar per klass/kurs
- **📅 Kvartal** – Skapa och hantera kvartal
- **🗄️ Arkiv** – Arkiverade elever/kurser/klasser
- **⚖️ Jämförelser** – Jämför kvartal, klasser, kurser
- **📸 Snapshots** – Spara betygsdata vid specifika tidpunkter
- **📊 Export** – PDF och Excel-rapporter
- **🌙 Dark Mode** – Automatiskt tema baserat på systempreferens

### Nya fördelar med Next.js:

- **⚡ Snabbare laddning** – Code splitting och lazy loading
- **🔧 Enklare underhåll** – Modulär komponentstruktur
- **📱 Responsivt** – Anpassat för mobil och desktop
- **🔌 API-redo** – Server-side API-routes för framtida integrationer
- **🤖 AI-redo** – Stub för AI-funktioner (OpenAI etc.)

---

## 🔌 Framtida integrationer

### Elevdatabas-API

Implementera `/api/students/route.ts`:

```typescript
export async function GET() {
  // Anslut till er elevdatabas
  const response = await fetch(process.env.ELEVDATABAS_API_URL, {
    headers: { 'Authorization': `Bearer ${process.env.ELEVDATABAS_API_KEY}` }
  });
  return Response.json(await response.json());
}
```

### AI-funktioner

Implementera `/api/ai/route.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

export async function POST(request: Request) {
  const { prompt } = await request.json();
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }]
  });
  
  return Response.json({ response: completion.choices[0].message.content });
}
```

---

## 🎨 Tema

Appen använder Järva Gymnasiums färgprofil:

| Färg | Hex | Användning |
|------|-----|------------|
| Primary | `#624c9a` | Huvud-lila |
| Primary Darker | `#4a3a7a` | Hover/active |
| Accent Orange | `#f5a831` | Varningar, knappar |
| Accent Pink | `#e72c81` | Gradient, accenter |
| Accent Blue | `#43bde3` | Statistik, länkar |

---

## 🔒 Roller och behörigheter

| Roll | Behörigheter |
|------|-------------|
| **Admin** | Alla funktioner |
| **Teacher** | Visa data + sätta betyg |
| **Analyst** | Endast visa data |

Permanenta admins (kan inte ändras):
- `iman.ehsani@jarvagymnasium.se`
- `ala.nestani.rad@jarvagymnasium.se`
- `amir.sajadi@jarvagymnasium.se`

---

## 📋 Utvecklingsguide

### Lägga till ny tab

1. Skapa komponent i `src/components/tabs/NyTab.tsx`
2. Lägg till i `TabId` type i `src/lib/types.ts`
3. Lägg till i `TABS` array i `src/components/Header.tsx`
4. Lägg till case i `renderTab()` i `src/components/Dashboard.tsx`

### Lägga till ny API-route

1. Skapa mapp i `src/app/api/[namn]/`
2. Skapa `route.ts` med GET/POST/etc handlers
3. Använd miljövariabler för känslig data

---

## 🐛 Felsökning

### "Supabase error: Invalid login"
- Kontrollera att användaren finns i Supabase Auth
- Verifiera lösenord

### "Permission denied"
- Kontrollera användarens roll i `profiles`-tabellen
- Permanenta admins har alltid full access

### Build-fel
```bash
npm run build
# Om TypeScript-fel, kör:
npm run lint
```

---

## 📝 Licens

Internt projekt för Järva Gymnasium.

---

## 🙏 Bidragsgivare

Utvecklat för Järva Gymnasium resultatanalysarbete.
