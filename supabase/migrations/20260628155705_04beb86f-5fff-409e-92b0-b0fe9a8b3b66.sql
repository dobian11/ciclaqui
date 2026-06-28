ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.companies REPLICA IDENTITY FULL;
ALTER TABLE public.company_reviews REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_reviews;