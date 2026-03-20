# Verslo Valdymo Sistema (VVS) — Projekto Kontekstas

## Apie sistemą

Tai verslo valdymo sistema skirta individualiam verslui. Sistema leidžia sekti projektus, finansus, sandėlį, marketingą ir planuoti darbus kalendoriuje. Tikslas — kuo labiau sumažinti rankinį darbą ir turėti realų finansinį vaizdą.

---

## Tech Stack

- **Frontend:** Next.js su TypeScript
- **Backend / DB:** Supabase (duomenų bazė + API)
- **Stilius:** Tailwind CSS
- **Version control:** GitHub
- **Hosting:** Hostinger

---

## Kas jau padaryta

- Supabase projektas sukurtas ir sujungtas
- Next.js projektas sukurtas su TypeScript
- Supabase client ir ENV konfigūracija
- Testinis `/test-db` puslapis (ryšys su DB patikrintas)
- GitHub repo sukurtas, kodas įkeltas
- Aplikacija deploy'inta Hostinger platformoje
- Patikrintas veikimas production aplinkoje

## Kas dar NĖRA padaryta

- DB schema (lentelės dar nesukurtos)
- Layout su navigacija
- Auth sistema (prisijungimas)
- UI komponentai
- Visi moduliai (žr. žemiau)

---

## Moduliai (reikia sukurti)

### 🛍️ 1. Products / Pricebook
Produktų sąrašas su savikaina ir pardavimo kaina. Pricebook leidžia skirtingiems klientams turėti skirtingas kainas. Kai kuriamas projektas — kainos užsikrauna automatiškai, bet jas galima keisti rankiniu būdu.

### 📁 2. Sales (projektai)
Pagrindinis modulis. Kiekvienas projektas turi medžiagas, darbą, statusą (vykdoma / baigta) ir finansinį statusą (neišrašyta sąskaita / išrašyta / apmokėta). Automatiškai skaičiuojasi Revenue, Profit ir Margin.

**Projekto laukai:**
- Pavadinimas, klientas, lead source (META / Google / TikTok / Referral)
- Operacinis statusas: In progress / Finished
- Finansinis statusas: Not invoiced / Invoiced / Paid / Overdue
- Pradžios data, pabaigos data, planuojama sąskaitos data
- Medžiagos (iš Products), darbas (Work), papildomos išlaidos

**Automatiniai skaičiavimai:**
- Revenue = Sell Materials + Work
- Cost = Material Cost + Extra Costs
- Profit = Revenue - Cost
- Margin % = Profit / Revenue

### 📦 3. Warehouse (sandėlis)
Sandėlio likučiai su savikaina. Kai medžiaga panaudojama projekte — likutis mažėja automatiškai. Rodoma bendra sandėlio vertė, užsakytos bet neatvežtos medžiagos, įspėjimas kai likutis per mažas (min stock).

**Papildoma:**
- Judėjimo istorija (kas pridėjo / nurašė / kada)
- Low stock alert kai qty < min_stock

### 📣 4. Marketing
Išlaidų sekimas pagal kanalą (META, Google, TikTok ir t.t.). Projektai turi "lead source" lauką — taip sistema žino iš kurio kanalo atėjo klientas.

**Automatiniai KPI:**
- CPL = Budget / Leads
- Cost per Sale = Total Spend / Won Projects
- ROAS = Revenue from source / Marketing spend
- Lead → Won % = Won projects / Total leads

### 💵 5. Cashflow
Pinigų srauto modulis. Rodo kas planuojama gauti, kas išrašyta, kas gauta, kas vėluoja ir prognozę į priekį.

**Rodikliai:**
1. Planned revenue (pagal planned invoice date)
2. Invoiced revenue
3. Received payments
4. Outstanding
5. Overdue
6. Net cash forecast

### 🏠 6. Dashboard (pagrindinis ekranas)
KPI blokai viršuje + grafikai apačioje.

**KPI:**
- Revenue, Profit, Margin %, Marketing Spend, Warehouse Value, Backlog

**Grafikai:**
- Revenue per mėnesį
- Profit per mėnesį
- Marketing spend vs Revenue
- Backlog tendencija
- Cashflow forecast

### 📋 7. Bids (pasiūlymai)
Potencialūs projektai prieš tampant realiais. Vienu mygtuku "Convert to Project" konvertuojamas į Sales projektą.

**Automatiniai rodikliai:**
- Win rate %
- Average margin %
- Average bid value
- Bid → Project conversion %

### 📅 8. Kalendorius
Visi projektai atvaizduojami kalendoriuje pagal pradžios ir pabaigos datas. Savaitės ir mėnesio vaizdas. Baigti projektai lieka kita spalva (istorija). Priminimai apie artėjančius darbus ir sąskaitų datas.

---

## Finansinė logika (svarbu)

- **Revenue** skaičiuojamas pagal **Invoice date**
- **Backlog** = projektai užsakyti, bet dar neinvoicinti
- **Cashflow** = gautina suma
- **Warehouse value** = SUM(qty × supplier price)
- Mokėjimo statusas nustatomas **automatiškai** pagal datas

---

## Kūrimo tvarka (rekomenduojama)

1. DB schema (visos lentelės Supabase)
2. Layout + navigacija
3. Auth sistema
4. Sales modulis
5. Products / Pricebook
6. Warehouse
7. Bids
8. Marketing
9. Cashflow
10. Dashboard
11. Kalendorius
