-- 1. Pastikan kolom chat_history ada
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS chat_history JSONB;

-- 2. Pastikan RLS Policies aktif (PENTING untuk Public Submission)
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada (untuk menghindari duplikat error)
DROP POLICY IF EXISTS "Enable insert for anon" ON submissions;
DROP POLICY IF EXISTS "Enable select for anon" ON submissions;

-- Buat policy baru yang mengizinkan Insert & Select public
CREATE POLICY "Enable insert for anon" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for anon" ON submissions FOR SELECT USING (true);
