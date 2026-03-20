-- =============================================
-- WAREHOUSE MODULE — Supabase SQL
-- Paleiskite Supabase SQL Editor'yje
-- =============================================

-- 1. warehouse_movements lentelė
create table if not exists warehouse_movements (
  id          uuid default gen_random_uuid() primary key,
  product_id  uuid not null references products(id) on delete cascade,
  type        text not null check (type in ('add', 'remove')),
  qty         numeric not null check (qty > 0),
  project_id  uuid references sales(id) on delete set null,
  note        text,
  created_at  timestamptz default now()
);

-- Indeksai greitesnėms užklausoms
create index if not exists warehouse_movements_product_id_idx on warehouse_movements(product_id);
create index if not exists warehouse_movements_created_at_idx on warehouse_movements(created_at desc);

-- 2. RLS — warehouse_movements
alter table warehouse_movements enable row level security;

-- Leidžiame viską autentifikuotiems vartotojams
create policy "warehouse_movements_auth_all"
  on warehouse_movements
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 3. RLS — products (jei dar neįjungta)
alter table products enable row level security;

create policy "products_auth_all"
  on products
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4. RLS — sales (jei dar neįjungta)
alter table sales enable row level security;

create policy "sales_auth_all"
  on sales
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- =============================================
-- PATIKRINIMAS: ar lentelė sukurta
-- =============================================
-- select * from warehouse_movements limit 5;
