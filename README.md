# Järva Gymnasium – Resultatanalys (Next.js)

En fullständig React/Next.js-omskrivning av resultatanalysverktyget.

---

## 🚀 Snabbstart

### 1. Klona repot
```bash
git clone https://github.com/jarvagymnasium/resultatanays.git
cd resultatanays
```

### 2. Konfigurera miljövariabler
```bash
# Kopiera exempel-filen
cp env.example .env.local

# Redigera .env.local med dina värden:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_ADMIN_EMAILS
```

### 3. Installera och kör
```bash
npm install      # Installera beroenden
npm run dev      # Starta dev-server (http://localhost:3000)
```

### Produktionsbygge
```bash
npm run build
npm start
```

---

## 🔐 Miljövariabler

Skapa en `.env.local` fil (kopiera från `env.example`):

| Variabel | Beskrivning |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Din Supabase projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Din Supabase anon/public key |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Kommaseparerade admin-emails |

⚠️ **Viktigt:** Lägg aldrig `.env.local` i Git! Den är redan i `.gitignore`.

---

## 📁 Projektstruktur

```
├── src/
│   ├── app/
│   │   ├── page.tsx          # Huvudsida (login/dashboard)
│   │   ├── layout.tsx        # Root layout
│   │   ├── globals.css       # Globala stilar (Järva-tema)
│   │   └── api/              # API-routes
│   ├── components/
│   │   ├── LoginScreen.tsx   # Inloggningsskärm
│   │   ├── Dashboard.tsx     # Huvuddashboard
│   │   ├── Header.tsx        # Header med tabs
│   │   ├── modals/
│   │   └── tabs/
│   │       ├── WarningsTab.tsx    # F-varningar + grafer
│   │       ├── ProgressTab.tsx    # Betygsutveckling
│   │       ├── ClassesTab.tsx     # Klasser CRUD
│   │       ├── CoursesTab.tsx     # Kurser CRUD
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
├── env.example               # Mall för miljövariabler
└── README.md
```

---

## ✨ Funktioner

- **🔐 Autentisering** – Supabase Auth med rollbaserad åtkomst
- **⚠️ F-varningar** – Dashboard med statistik och grafer
- **📈 Utveckling** – Spårning av betygsförbättringar
- **🏫 Klasser** – CRUD med kurskopplingar
- **📚 Kurser** – CRUD med favoriter och filtrering
- **👥 Elever** – CRUD med klassplacering och dubblettdetektering
- **📝 Betygsättning** – Betyg och varningar per klass/kurs
- **📅 Kvartal** – Skapa och hantera kvartal
- **🗄️ Arkiv** – Arkiverade elever/kurser/klasser
- **⚖️ Jämförelser** – Jämför kvartal, klasser, kurser
- **📸 Snapshots** – Spara betygsdata vid specifika tidpunkter
- **📊 Export** – PDF och Excel-rapporter

---

## 🔒 Roller och behörigheter

| Roll | Behörigheter |
|------|-------------|
| **Admin** | Alla funktioner |
| **Teacher** | Visa data + sätta betyg |
| **Analyst** | Endast visa data |

Admin-emails konfigureras i `.env.local` via `NEXT_PUBLIC_ADMIN_EMAILS`.

---

## 🎨 Tema

Appen använder Järva Gymnasiums färgprofil:

| Färg | Hex | Användning |
|------|-----|------------|
| Primary | `#624c9a` | Huvud-lila |
| Accent Orange | `#f5a831` | Varningar, knappar |
| Accent Pink | `#e72c81` | Gradient, accenter |
| Accent Blue | `#43bde3` | Statistik, länkar |

---

## 🐛 Felsökning

### "Missing Supabase environment variables"
- Kontrollera att `.env.local` finns och har rätt värden
- Starta om dev-servern efter ändringar i `.env.local`

### "Permission denied"
- Kontrollera att din email finns i `NEXT_PUBLIC_ADMIN_EMAILS`
- Kontrollera användarens roll i `profiles`-tabellen

---

## 📝 Licens

Internt projekt för Järva Gymnasium.
