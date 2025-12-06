-- Add admin role to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for admin lookups
CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin) WHERE is_admin = true;

-- Set the first user as admin (you can change this email)
-- UPDATE users SET is_admin = true WHERE email = 'admin@roizenlabs.com';
