-- BankTarot Private Advisor OS — คลังข้อมูลหลัก
-- รัน SQL นี้ครั้งเดียวใน Supabase > SQL Editor
create table if not exists app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- ปิด RLS ไม่ได้ใช้ anon key — เข้าถึงผ่าน service role ฝั่ง server เท่านั้น
alter table app_state enable row level security;
