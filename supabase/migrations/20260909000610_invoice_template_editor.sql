-- Editable company invoice templates. Preserve existing extensions.


  create table "public"."invoice_templates" (
    "company_id" uuid not null,
    "settings" jsonb not null default '{}'::jsonb,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."invoice_templates" enable row level security;

CREATE UNIQUE INDEX invoice_templates_pkey ON public.invoice_templates USING btree (company_id);

alter table "public"."invoice_templates" add constraint "invoice_templates_pkey" PRIMARY KEY using index "invoice_templates_pkey";

alter table "public"."invoice_templates" add constraint "invoice_templates_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) not valid;

alter table "public"."invoice_templates" validate constraint "invoice_templates_company_id_fkey";

alter table "public"."invoice_templates" add constraint "invoice_templates_settings_check" CHECK (((jsonb_typeof(settings) = 'object'::text) AND (octet_length((settings)::text) < 500000))) not valid;

alter table "public"."invoice_templates" validate constraint "invoice_templates_settings_check";

grant insert on table "public"."invoice_templates" to "authenticated";

grant select on table "public"."invoice_templates" to "authenticated";

grant update on table "public"."invoice_templates" to "authenticated";

grant delete on table "public"."invoice_templates" to "service_role";

grant insert on table "public"."invoice_templates" to "service_role";

grant references on table "public"."invoice_templates" to "service_role";

grant select on table "public"."invoice_templates" to "service_role";

grant trigger on table "public"."invoice_templates" to "service_role";

grant truncate on table "public"."invoice_templates" to "service_role";

grant update on table "public"."invoice_templates" to "service_role";


  create policy "invoice_template_insert"
  on "public"."invoice_templates"
  as permissive
  for insert
  to authenticated
with check (private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'accountant'::public.member_role]));



  create policy "invoice_template_read"
  on "public"."invoice_templates"
  as permissive
  for select
  to authenticated
using (private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'accountant'::public.member_role, 'auditor'::public.member_role]));



  create policy "invoice_template_update"
  on "public"."invoice_templates"
  as permissive
  for update
  to authenticated
using (private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'accountant'::public.member_role]))
with check (private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'accountant'::public.member_role]));




revoke all on public.invoice_templates from public, anon, authenticated;
grant select, insert, update on public.invoice_templates to authenticated;
