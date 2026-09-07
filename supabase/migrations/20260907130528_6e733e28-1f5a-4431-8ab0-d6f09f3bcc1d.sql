UPDATE public.companies
SET status = 'approved'::public.company_status,
    approved_at = CASE id
      WHEN 'ba386e7b-d9d1-480a-a6cc-804eadb9bcff'::uuid THEN '2026-09-07T12:58:45.931661+00'::timestamptz
      WHEN '3fb5a8f8-8856-4117-8143-2334bf0ab25a'::uuid THEN '2026-09-07T12:58:43.585705+00'::timestamptz
    END,
    approved_by = '09e9dacf-9490-4779-8d2d-ce0618ecf001'::uuid,
    rejection_reason = NULL
WHERE id IN (
  'ba386e7b-d9d1-480a-a6cc-804eadb9bcff'::uuid,
  '3fb5a8f8-8856-4117-8143-2334bf0ab25a'::uuid
);

UPDATE public.company_reviews
SET status = 'approved',
    reason = NULL,
    reviewed_by = '09e9dacf-9490-4779-8d2d-ce0618ecf001'::uuid,
    reviewed_at = now()
WHERE company_id IN (
  'ba386e7b-d9d1-480a-a6cc-804eadb9bcff'::uuid,
  '3fb5a8f8-8856-4117-8143-2334bf0ab25a'::uuid
)
AND status = 'pending';