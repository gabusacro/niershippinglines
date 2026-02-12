-- Add infant (below 7 years old) fare type
ALTER TYPE fare_type_enum ADD VALUE IF NOT EXISTS 'infant';
