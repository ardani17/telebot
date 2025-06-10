-- TeleWeb Admin User Setup Script
-- Run this to add admin user 731289973 to the database

-- First, let's check if tables exist
\dt

-- Create admin user
INSERT INTO "User" (
    id,
    "telegramId",
    name,
    username,
    role,
    "isActive",
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid(),
    '731289973',
    'Ardani',
    'yaelahdan',
    'ADMIN',
    true,
    NOW(),
    NOW()
) ON CONFLICT ("telegramId") DO UPDATE SET
    name = EXCLUDED.name,
    username = EXCLUDED.username,
    role = EXCLUDED.role,
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = NOW();

-- Grant all features to admin user
INSERT INTO "UserFeatureAccess" (
    id,
    "userId",
    "featureId",
    "grantedAt",
    "grantedBy"
)
SELECT 
    gen_random_uuid(),
    u.id,
    f.id,
    NOW(),
    u.id
FROM "User" u
CROSS JOIN "Feature" f
WHERE u."telegramId" = '731289973'
ON CONFLICT ("userId", "featureId") DO NOTHING;

-- Verify the user was created
SELECT 
    u.id,
    u."telegramId",
    u.name,
    u.username,
    u.role,
    u."isActive",
    COUNT(ufa.id) as feature_count
FROM "User" u
LEFT JOIN "UserFeatureAccess" ufa ON u.id = ufa."userId"
WHERE u."telegramId" = '731289973'
GROUP BY u.id, u."telegramId", u.name, u.username, u.role, u."isActive"; 