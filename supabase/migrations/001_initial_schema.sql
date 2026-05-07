-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES (extends auth.users)
-- =============================================
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('property_manager','property_owner','contractor','resident','admin')),
  phone text,
  company_name text,
  avatar_url text,
  bio text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- PROPERTIES
-- =============================================
create table properties (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text not null,
  city text,
  postcode text,
  description text,
  total_rooms int,
  created_at timestamptz default now()
);

-- =============================================
-- ROOMS
-- =============================================
create table rooms (
  id uuid default uuid_generate_v4() primary key,
  property_id uuid references properties(id) on delete cascade,
  number text not null,
  name text,
  floor int,
  resident_id uuid references profiles(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- MAINTENANCE TICKETS
-- =============================================
create table maintenance_tickets (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text not null,
  category text,
  priority text not null check (priority in ('low','medium','high','urgent')) default 'medium',
  status text not null check (status in (
    'pending','awaiting_quote','approved','in_progress',
    'awaiting_inspection','completed','rejected','paid'
  )) default 'pending',
  room_id uuid references rooms(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  assigned_contractor uuid references profiles(id) on delete set null,
  deadline timestamptz,
  estimated_cost numeric(10,2),
  actual_cost numeric(10,2),
  completion_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- TICKET ATTACHMENTS
-- =============================================
create table ticket_attachments (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references maintenance_tickets(id) on delete cascade not null,
  uploaded_by uuid references profiles(id) on delete set null,
  file_name text not null,
  file_url text not null,
  file_path text,
  file_type text check (file_type in ('image','video','document','invoice','quote','receipt')) default 'image',
  mime_type text,
  label text,
  file_size int,
  created_at timestamptz default now()
);

-- =============================================
-- TICKET COMMENTS
-- =============================================
create table ticket_comments (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references maintenance_tickets(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete set null,
  content text not null,
  is_internal boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- QUOTATIONS
-- =============================================
create table quotations (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references maintenance_tickets(id) on delete cascade not null,
  contractor_id uuid references profiles(id) on delete set null,
  status text not null check (status in (
    'draft','submitted','pending_owner_approval','approved','rejected','expired'
  )) default 'submitted',
  total_amount numeric(10,2) not null,
  valid_until date,
  estimated_days int,
  notes text,
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- QUOTE LINE ITEMS
-- =============================================
create table quote_items (
  id uuid default uuid_generate_v4() primary key,
  quote_id uuid references quotations(id) on delete cascade not null,
  description text not null,
  item_type text check (item_type in ('labour','material','equipment','other')) default 'labour',
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null,
  total numeric(10,2) not null
);

-- =============================================
-- QUOTE ATTACHMENTS (invoices, supporting docs)
-- =============================================
create table quote_attachments (
  id uuid default uuid_generate_v4() primary key,
  quote_id uuid references quotations(id) on delete cascade not null,
  uploaded_by uuid references profiles(id) on delete set null,
  file_name text not null,
  file_url text not null,
  file_type text default 'document',
  created_at timestamptz default now()
);

-- =============================================
-- APPROVALS
-- =============================================
create table approvals (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references maintenance_tickets(id) on delete cascade,
  quote_id uuid references quotations(id) on delete cascade,
  approver_id uuid references profiles(id) on delete set null,
  type text not null check (type in ('quote_approval','inspection','payment_authorization')),
  decision text not null check (decision in ('approved','rejected')),
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- PAYMENTS
-- =============================================
create table payments (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references maintenance_tickets(id) on delete cascade,
  contractor_id uuid references profiles(id) on delete set null,
  quote_id uuid references quotations(id) on delete set null,
  amount numeric(10,2) not null,
  payment_method text check (payment_method in ('bank_transfer','cash','cheque','online')),
  status text not null check (status in ('pending','authorized','paid','cancelled')) default 'pending',
  reference text,
  transaction_ref text,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  authorized_by uuid references profiles(id) on delete set null,
  authorized_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- CONTRACTOR RATINGS
-- =============================================
create table contractor_ratings (
  id uuid default uuid_generate_v4() primary key,
  contractor_id uuid references profiles(id) on delete cascade not null,
  ticket_id uuid references maintenance_tickets(id) on delete cascade not null,
  rated_by uuid references profiles(id) on delete set null,
  category text not null check (category in ('quality','timeliness','communication','value','overall')),
  rating numeric(2,1) not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  unique (contractor_id, ticket_id, category)
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
create table notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  message text,
  type text,
  entity_type text,
  entity_id uuid,
  read boolean default false,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================
-- AUDIT LOGS
-- =============================================
create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}',
  ip_address inet,
  created_at timestamptz default now()
);

-- =============================================
-- INDEXES
-- =============================================
create index idx_tickets_status on maintenance_tickets(status);
create index idx_tickets_priority on maintenance_tickets(priority);
create index idx_tickets_created_by on maintenance_tickets(created_by);
create index idx_tickets_assigned on maintenance_tickets(assigned_contractor);
create index idx_tickets_room on maintenance_tickets(room_id);
create index idx_quotations_ticket on quotations(ticket_id);
create index idx_quotations_contractor on quotations(contractor_id);
create index idx_payments_ticket on payments(ticket_id);
create index idx_payments_contractor on payments(contractor_id);
create index idx_notifications_user on notifications(user_id, read);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_user on audit_logs(user_id);
create index idx_ratings_contractor on contractor_ratings(contractor_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table profiles enable row level security;
alter table maintenance_tickets enable row level security;
alter table ticket_attachments enable row level security;
alter table ticket_comments enable row level security;
alter table quotations enable row level security;
alter table quote_items enable row level security;
alter table approvals enable row level security;
alter table payments enable row level security;
alter table contractor_ratings enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table rooms enable row level security;

-- Profiles: users can read all profiles, update own
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);

-- Notifications: users only see their own
create policy "notifications_own" on notifications for all using (auth.uid() = user_id);

-- Audit logs: managers/owners/admin can read, service role writes
create policy "audit_logs_read" on audit_logs for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('property_manager','property_owner','admin')
    )
  );

-- All authenticated users can read tickets
create policy "tickets_read" on maintenance_tickets for select using (auth.uid() is not null);
create policy "tickets_insert" on maintenance_tickets for insert with check (auth.uid() is not null);
create policy "tickets_update" on maintenance_tickets for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('property_manager','property_owner','admin')
    )
    or created_by = auth.uid()
  );

-- Quotations: contractors see own, staff see all
create policy "quotes_read" on quotations for select using (
  auth.uid() is not null and (
    contractor_id = auth.uid()
    or exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('property_manager','property_owner','admin')
    )
  )
);
create policy "quotes_insert" on quotations for insert
  with check (contractor_id = auth.uid());
create policy "quotes_update" on quotations for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('property_manager','property_owner','admin')
    )
  );

-- Rooms: all authenticated
create policy "rooms_read" on rooms for select using (auth.uid() is not null);

-- Attachments: authenticated
create policy "attachments_read" on ticket_attachments for select using (auth.uid() is not null);
create policy "attachments_insert" on ticket_attachments for insert with check (auth.uid() is not null);

-- Comments: authenticated read, insert; managers can delete
create policy "comments_read" on ticket_comments for select using (auth.uid() is not null);
create policy "comments_insert" on ticket_comments for insert with check (auth.uid() is not null);

-- Payments: staff only
create policy "payments_read" on payments for select
  using (
    contractor_id = auth.uid()
    or exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('property_manager','property_owner','admin')
    )
  );

-- Quote items: follow parent quotation access
create policy "quote_items_read" on quote_items for select using (
  exists (
    select 1 from quotations q
    where q.id = quote_id
    and (
      q.contractor_id = auth.uid()
      or exists (
        select 1 from profiles where id = auth.uid()
        and role in ('property_manager','property_owner','admin')
      )
    )
  )
);

-- Approvals: staff read
create policy "approvals_read" on approvals for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('property_manager','property_owner','admin','contractor')
    )
  );

-- Ratings: authenticated read
create policy "ratings_read" on contractor_ratings for select using (auth.uid() is not null);
create policy "ratings_write" on contractor_ratings for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('property_manager','property_owner','admin')
    )
  );

-- =============================================
-- SEED DATA
-- =============================================
insert into properties (id, name, address, city, postcode, total_rooms) values
  ('00000000-0000-0000-0000-000000000001', 'Shared House', '123 Main Street', 'London', 'SW1A 1AA', 11);

insert into rooms (property_id, number, name, floor) values
  ('00000000-0000-0000-0000-000000000001', '1', 'Room 1', 0),
  ('00000000-0000-0000-0000-000000000001', '2', 'Room 2', 0),
  ('00000000-0000-0000-0000-000000000001', '3', 'Room 3', 1),
  ('00000000-0000-0000-0000-000000000001', '4', 'Room 4', 1),
  ('00000000-0000-0000-0000-000000000001', '5', 'Room 5', 1),
  ('00000000-0000-0000-0000-000000000001', '6', 'Room 6', 1),
  ('00000000-0000-0000-0000-000000000001', '7', 'Room 7', 2),
  ('00000000-0000-0000-0000-000000000001', '8', 'Room 8', 2),
  ('00000000-0000-0000-0000-000000000001', '9', 'Room 9', 2),
  ('00000000-0000-0000-0000-000000000001', '10', 'Room 10', 2),
  ('00000000-0000-0000-0000-000000000001', '11', 'Room 11', 2),
  ('00000000-0000-0000-0000-000000000001', 'G', 'Ground Floor Common Area', 0),
  ('00000000-0000-0000-0000-000000000001', 'K', 'Kitchen', 0),
  ('00000000-0000-0000-0000-000000000001', 'L', 'Laundry Room', 0),
  ('00000000-0000-0000-0000-000000000001', 'B1', 'Bathroom 1 (Ground)', 0),
  ('00000000-0000-0000-0000-000000000001', 'B2', 'Bathroom 2 (First)', 1),
  ('00000000-0000-0000-0000-000000000001', 'B3', 'Bathroom 3 (Second)', 2),
  ('00000000-0000-0000-0000-000000000001', 'EXT', 'External / Garden', -1);
