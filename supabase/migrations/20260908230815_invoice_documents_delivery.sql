-- Invoice documents and server-managed email delivery. Preserve existing extensions.


  create table "public"."company_email_settings" (
    "company_id" uuid not null,
    "sender_email" text not null,
    "sender_name" text not null,
    "encrypted_api_key" text not null,
    "updated_by" uuid not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."company_email_settings" enable row level security;


  create table "public"."invoice_email_deliveries" (
    "id" uuid not null,
    "company_id" uuid not null,
    "invoice_id" uuid not null,
    "recipient" text not null,
    "sender_email" text not null,
    "subject" text not null,
    "status" text not null default 'queued'::text,
    "provider_id" text,
    "last_error" text,
    "created_by" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "first_attempt_at" timestamp with time zone,
    "lease_until" timestamp with time zone,
    "accepted_at" timestamp with time zone
      );


alter table "public"."invoice_email_deliveries" enable row level security;


  create table "public"."invoice_email_payloads" (
    "delivery_id" uuid not null,
    "payload" jsonb not null
      );


alter table "public"."invoice_email_payloads" enable row level security;

CREATE UNIQUE INDEX company_email_settings_pkey ON public.company_email_settings USING btree (company_id);

CREATE INDEX company_email_updated_by_idx ON public.company_email_settings USING btree (updated_by);

CREATE INDEX invoice_email_creator_idx ON public.invoice_email_deliveries USING btree (created_by);

CREATE UNIQUE INDEX invoice_email_deliveries_company_id_id_key ON public.invoice_email_deliveries USING btree (company_id, id);

CREATE UNIQUE INDEX invoice_email_deliveries_pkey ON public.invoice_email_deliveries USING btree (id);

CREATE INDEX invoice_email_invoice_idx ON public.invoice_email_deliveries USING btree (company_id, invoice_id, created_at);

CREATE UNIQUE INDEX invoice_email_payloads_pkey ON public.invoice_email_payloads USING btree (delivery_id);

alter table "public"."company_email_settings" add constraint "company_email_settings_pkey" PRIMARY KEY using index "company_email_settings_pkey";

alter table "public"."invoice_email_deliveries" add constraint "invoice_email_deliveries_pkey" PRIMARY KEY using index "invoice_email_deliveries_pkey";

alter table "public"."invoice_email_payloads" add constraint "invoice_email_payloads_pkey" PRIMARY KEY using index "invoice_email_payloads_pkey";

alter table "public"."company_email_settings" add constraint "company_email_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) not valid;

alter table "public"."company_email_settings" validate constraint "company_email_settings_company_id_fkey";

alter table "public"."company_email_settings" add constraint "company_email_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) not valid;

alter table "public"."company_email_settings" validate constraint "company_email_settings_updated_by_fkey";

alter table "public"."invoice_email_deliveries" add constraint "invoice_email_deliveries_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.companies(id) not valid;

alter table "public"."invoice_email_deliveries" validate constraint "invoice_email_deliveries_company_id_fkey";

alter table "public"."invoice_email_deliveries" add constraint "invoice_email_deliveries_company_id_id_key" UNIQUE using index "invoice_email_deliveries_company_id_id_key";

alter table "public"."invoice_email_deliveries" add constraint "invoice_email_deliveries_company_id_invoice_id_fkey" FOREIGN KEY (company_id, invoice_id) REFERENCES public.invoices(company_id, id) not valid;

alter table "public"."invoice_email_deliveries" validate constraint "invoice_email_deliveries_company_id_invoice_id_fkey";

alter table "public"."invoice_email_deliveries" add constraint "invoice_email_deliveries_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."invoice_email_deliveries" validate constraint "invoice_email_deliveries_created_by_fkey";

alter table "public"."invoice_email_deliveries" add constraint "invoice_email_deliveries_status_check" CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'accepted'::text, 'failed'::text, 'unknown'::text]))) not valid;

alter table "public"."invoice_email_deliveries" validate constraint "invoice_email_deliveries_status_check";

alter table "public"."invoice_email_payloads" add constraint "invoice_email_payloads_delivery_id_fkey" FOREIGN KEY (delivery_id) REFERENCES public.invoice_email_deliveries(id) not valid;

alter table "public"."invoice_email_payloads" validate constraint "invoice_email_payloads_delivery_id_fkey";

alter table "public"."invoice_email_payloads" add constraint "invoice_email_payloads_payload_check" CHECK ((pg_column_size(payload) < 6000000)) not valid;

alter table "public"."invoice_email_payloads" validate constraint "invoice_email_payloads_payload_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.claim_invoice_email(delivery_id_value uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare claimed uuid;
begin
 update public.invoice_email_deliveries set status='processing',first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '2 minutes',last_error=null
 where id=delivery_id_value and status<>'accepted' and (lease_until is null or lease_until<now()) and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours') returning id into claimed;
 return claimed is not null;
end $function$
;

CREATE OR REPLACE FUNCTION public.invoice_document(target_company_id uuid, target_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare document jsonb;
begin
 if auth.uid() is null or not private.has_company_role(target_company_id,array['owner','administrator','accountant','auditor']::public.member_role[]) then raise exception 'Finance access required';end if;
 select jsonb_build_object(
  'id',i.id,'number','INV-'||i.invoice_number,'issuedOn',i.issued_on,'dueOn',i.due_on,'status',i.status,'notes',coalesce(i.notes,''),
  'subtotal',i.subtotal,'tax',i.tax,'discount',i.discount,'total',i.total,'ledgerManaged',i.ledger_managed,'posted',i.journal_entry_id is not null,
  'company',jsonb_build_object('name',c.legal_name,'displayName',c.display_name),
  'customer',jsonb_build_object('name',cu.name,'email',coalesce(cu.email,''),'address',cu.billing_address),
  'items',coalesce((select jsonb_agg(jsonb_build_object('description',li.description,'quantity',li.quantity,'unitPrice',li.unit_price,'taxRate',li.tax_rate) order by li.sort_order,li.id) from public.invoice_items li where li.company_id=i.company_id and li.invoice_id=i.id),'[]'::jsonb),
  'payments',coalesce((select sum(p.amount) from public.payments p where p.company_id=i.company_id and p.invoice_id=i.id),0),
  'adjustments',coalesce((select sum(a.amount) from public.customer_payment_adjustments a where a.company_id=i.company_id and a.invoice_id=i.id),0),
  'credits',coalesce((select sum(n.amount) from public.credit_notes n where n.company_id=i.company_id and n.invoice_id=i.id),0)
 ) into document from public.invoices i join public.companies c on c.id=i.company_id join public.customers cu on cu.company_id=i.company_id and cu.id=i.customer_id where i.company_id=target_company_id and i.id=target_invoice_id;
 if document is null then raise exception 'Invoice not found';end if;
 return document;
end $function$
;

CREATE OR REPLACE FUNCTION public.prepare_invoice_email(delivery_id_value uuid, company_id_value uuid, invoice_id_value uuid, recipient_value text, sender_value text, subject_value text, actor_value uuid, payload_value jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare existing public.invoice_email_deliveries%rowtype;
begin
 if not exists(select 1 from public.company_memberships where company_id=company_id_value and user_id=actor_value and is_active and role in ('owner','administrator','accountant')) then raise exception 'Finance access required';end if;
 perform pg_advisory_xact_lock(hashtextextended(delivery_id_value::text,0));
 select * into existing from public.invoice_email_deliveries where id=delivery_id_value;
 if found then
  if existing.company_id<>company_id_value or existing.invoice_id<>invoice_id_value or existing.recipient<>recipient_value then raise exception 'Delivery reference was already used with different details';end if;
  return existing.id;
 end if;
 if not exists(select 1 from public.invoices where company_id=company_id_value and id=invoice_id_value and status<>'draft' and ledger_managed and journal_entry_id is not null) then raise exception 'Issue and post the invoice before emailing it';end if;
 insert into public.invoice_email_deliveries(id,company_id,invoice_id,recipient,sender_email,subject,created_by) values(delivery_id_value,company_id_value,invoice_id_value,recipient_value,sender_value,subject_value,actor_value);
 insert into public.invoice_email_payloads(delivery_id,payload) values(delivery_id_value,payload_value);
 return delivery_id_value;
end $function$
;

grant delete on table "public"."company_email_settings" to "service_role";

grant insert on table "public"."company_email_settings" to "service_role";

grant references on table "public"."company_email_settings" to "service_role";

grant select on table "public"."company_email_settings" to "service_role";

grant trigger on table "public"."company_email_settings" to "service_role";

grant truncate on table "public"."company_email_settings" to "service_role";

grant update on table "public"."company_email_settings" to "service_role";

grant select on table "public"."invoice_email_deliveries" to "authenticated";

grant delete on table "public"."invoice_email_deliveries" to "service_role";

grant insert on table "public"."invoice_email_deliveries" to "service_role";

grant references on table "public"."invoice_email_deliveries" to "service_role";

grant select on table "public"."invoice_email_deliveries" to "service_role";

grant trigger on table "public"."invoice_email_deliveries" to "service_role";

grant truncate on table "public"."invoice_email_deliveries" to "service_role";

grant update on table "public"."invoice_email_deliveries" to "service_role";

grant delete on table "public"."invoice_email_payloads" to "service_role";

grant insert on table "public"."invoice_email_payloads" to "service_role";

grant references on table "public"."invoice_email_payloads" to "service_role";

grant select on table "public"."invoice_email_payloads" to "service_role";

grant trigger on table "public"."invoice_email_payloads" to "service_role";

grant truncate on table "public"."invoice_email_payloads" to "service_role";

grant update on table "public"."invoice_email_payloads" to "service_role";


  create policy "invoice_email_read"
  on "public"."invoice_email_deliveries"
  as permissive
  for select
  to authenticated
using (private.has_company_role(company_id, ARRAY['owner'::public.member_role, 'administrator'::public.member_role, 'accountant'::public.member_role, 'auditor'::public.member_role]));




-- Schema diffs omit explicit revocations: never expose credentials or send RPCs.
revoke all on public.company_email_settings, public.invoice_email_payloads from public, anon, authenticated;
revoke all on public.invoice_email_deliveries from public, anon, authenticated;
grant select on public.invoice_email_deliveries to authenticated;
revoke all on function public.invoice_document(uuid,uuid) from public, anon;
grant execute on function public.invoice_document(uuid,uuid) to authenticated;
revoke all on function public.prepare_invoice_email(uuid,uuid,uuid,text,text,text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.claim_invoice_email(uuid) from public, anon, authenticated;
grant execute on function public.prepare_invoice_email(uuid,uuid,uuid,text,text,text,uuid,jsonb), public.claim_invoice_email(uuid) to service_role;
