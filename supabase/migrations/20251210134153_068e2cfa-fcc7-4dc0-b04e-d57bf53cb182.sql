-- Remove the overly restrictive constraint that blocks rebuys
DROP INDEX IF EXISTS sales_customer_status_unique;