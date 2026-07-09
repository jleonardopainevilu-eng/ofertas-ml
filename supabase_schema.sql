-- El Ofertón del Gatito — Supabase Fase 1
-- Objetivo: administrar comercio local, membresías, productos destacados, leads, votos y clics.
-- Ejecutar en Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Tiendas / comercios locales
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  rubro text,
  comuna text,
  ciudad text,
  region text,
  whatsapp text,
  instagram text,
  email text,
  logo_url text,
  descripcion text,
  plan text not null default 'fundador' check (plan in ('gratis','fundador','basico','destacado','premium','pausado')),
  status text not null default 'active' check (status in ('active','paused','expired','pending')),
  fecha_inicio date default current_date,
  fecha_vencimiento date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Productos/servicios de tiendas locales
create table if not exists public.local_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  titulo text not null,
  descripcion text,
  categoria text default 'general',
  precio_clp numeric default 0,
  precio_original_clp numeric default 0,
  imagen text,
  link_oferta text,
  destacado boolean not null default false,
  active boolean not null default true,
  stock text,
  votos integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Solicitudes desde la web: sumar tienda, pedir producto, ofrecer servicio
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'sumar_tienda',
  nombre text,
  negocio text,
  whatsapp text,
  email text,
  comuna text,
  rubro text,
  producto_buscado text,
  mascota text,
  mensaje text,
  origen text default 'web',
  estado text not null default 'nuevo' check (estado in ('nuevo','contactado','convertido','descartado')),
  created_at timestamptz not null default now()
);

-- Servicios de apoyo: paseadores, cuidadores, traslado, visitas, etc.
create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  servicio text not null,
  comuna text,
  region text,
  whatsapp text,
  descripcion text,
  valor_referencial text,
  disponibilidad text,
  imagen text,
  destacado boolean not null default false,
  status text not null default 'pending' check (status in ('active','paused','pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Clics y votos básicos para reportes a miembros
create table if not exists public.click_events (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  store_id uuid references public.stores(id) on delete set null,
  titulo text,
  origen text,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  fingerprint text,
  created_at timestamptz not null default now(),
  unique(product_id, fingerprint)
);

-- Vista pública que el index puede leer sin lógica compleja
create or replace view public.public_products_local as
select
  p.id::text as id,
  p.titulo,
  p.descripcion,
  p.categoria,
  p.precio_clp,
  p.precio_original_clp,
  case when p.precio_original_clp > p.precio_clp and p.precio_clp > 0
    then round((1 - p.precio_clp / p.precio_original_clp) * 100, 1)
    else 0
  end as descuento_pct,
  p.imagen,
  coalesce(p.link_oferta, case when s.whatsapp is not null and s.whatsapp <> '' then 'https://wa.me/' || regexp_replace(s.whatsapp, '[^0-9]', '', 'g') else null end) as link_oferta,
  s.name as tienda,
  s.whatsapp,
  coalesce(s.comuna, s.ciudad) as comuna,
  s.region,
  'local'::text as origen,
  p.destacado,
  case when s.plan in ('destacado','premium') then true else false end as premium,
  s.plan,
  p.votos,
  p.updated_at,
  p.created_at
from public.local_products p
join public.stores s on s.id = p.store_id
where p.active = true
  and s.status = 'active';

create or replace view public.public_service_providers as
select
  id::text,
  nombre,
  servicio,
  comuna,
  region,
  whatsapp,
  descripcion,
  valor_referencial,
  disponibilidad,
  imagen,
  destacado,
  created_at,
  updated_at
from public.service_providers
where status = 'active';

-- Índices útiles
create index if not exists idx_stores_status_plan on public.stores(status, plan);
create index if not exists idx_stores_comuna on public.stores(comuna);
create index if not exists idx_local_products_store on public.local_products(store_id);
create index if not exists idx_local_products_active_featured on public.local_products(active, destacado);
create index if not exists idx_leads_estado on public.leads(estado);
create index if not exists idx_click_events_created on public.click_events(created_at);

-- Updated_at automático
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_stores_updated_at on public.stores;
create trigger set_stores_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists set_local_products_updated_at on public.local_products;
create trigger set_local_products_updated_at
before update on public.local_products
for each row execute function public.set_updated_at();

drop trigger if exists set_service_providers_updated_at on public.service_providers;
create trigger set_service_providers_updated_at
before update on public.service_providers
for each row execute function public.set_updated_at();

-- RLS
alter table public.stores enable row level security;
alter table public.local_products enable row level security;
alter table public.leads enable row level security;
alter table public.service_providers enable row level security;
alter table public.click_events enable row level security;
alter table public.votes enable row level security;

-- Lectura pública solo para registros activos. Las vistas también se usan para simplificar el frontend.
drop policy if exists "public read active stores" on public.stores;
create policy "public read active stores" on public.stores
for select using (status = 'active');

drop policy if exists "public read active local products" on public.local_products;
create policy "public read active local products" on public.local_products
for select using (active = true);

drop policy if exists "public read active service providers" on public.service_providers;
create policy "public read active service providers" on public.service_providers
for select using (status = 'active');

-- Inserción pública controlada para leads, clics y votos. No se permite update/delete público.
drop policy if exists "public insert leads" on public.leads;
create policy "public insert leads" on public.leads
for insert with check (true);

drop policy if exists "public insert click events" on public.click_events;
create policy "public insert click events" on public.click_events
for insert with check (true);

drop policy if exists "public insert votes" on public.votes;
create policy "public insert votes" on public.votes
for insert with check (true);
