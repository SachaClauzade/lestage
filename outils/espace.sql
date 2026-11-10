-- ============================================================
-- Le Stage · la base de l'espace vidéos (Supabase).
-- Appliquée par outils/installer-espace.mjs. On peut la relancer :
-- elle ne touche ni aux participants ni aux jours déjà remplis.
--
-- Deux tables à remplir dans Supabase > Table Editor :
--   eleves : une ligne par personne qui a payé (email, prenom).
--            staff = true voit tous les jours en avance.
--   jours  : une ligne par jour. titre, objectif, video (lien YouTube non
--            répertorié, Loom ou Bunny), taches (une par ligne),
--            ressources (une par ligne : Texte | https://lien),
--            encart (1re ligne = titre, puis un paragraphe par ligne, **gras**).
--            ouvre_le s'affiche en UTC : 05:00 UTC = 6 h à Paris en novembre.
--
-- Aucune politique d'accès sur ces tables : personne ne les lit
-- directement. Seules les deux fonctions ci-dessous répondent, et c'est
-- l'horloge du serveur qui décide si un jour est ouvert.
-- ============================================================

create table if not exists public.eleves (
  email      text primary key,
  prenom     text,
  staff      boolean not null default false,
  ajoute_le  timestamptz not null default now()
);

create table if not exists public.jours (
  numero     int primary key check (numero > 0),
  ouvre_le   timestamptz not null,
  titre      text,
  objectif   text,
  video      text,
  taches     text,
  ressources text
);

alter table public.jours add column if not exists encart text;
-- Les prompts du jour : [{ "titre", "quand", "texte", "apres", "outil" }, …]
alter table public.jours add column if not exists prompts jsonb;

alter table public.eleves enable row level security;
alter table public.jours  enable row level security;

-- Un mail collé avec une majuscule ou une espace doit quand même marcher.
create or replace function public.eleves_normalise() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.email := lower(trim(new.email));
  return new;
end $$;

drop trigger if exists eleves_normalise on public.eleves;
create trigger eleves_normalise before insert or update on public.eleves
  for each row execute function public.eleves_normalise();

-- Du lundi au vendredi, du 16 au 27 novembre 2026, à 6 h à Paris.
insert into public.jours (numero, ouvre_le) values
  ( 1, '2026-11-16 06:00:00+01'),
  ( 2, '2026-11-17 06:00:00+01'),
  ( 3, '2026-11-18 06:00:00+01'),
  ( 4, '2026-11-19 06:00:00+01'),
  ( 5, '2026-11-20 06:00:00+01'),
  ( 6, '2026-11-23 06:00:00+01'),
  ( 7, '2026-11-24 06:00:00+01'),
  ( 8, '2026-11-25 06:00:00+01'),
  ( 9, '2026-11-26 06:00:00+01'),
  (10, '2026-11-27 06:00:00+01')
on conflict (numero) do nothing;

insert into public.eleves (email, prenom, staff)
values ('sacha.clauzade@gmail.com', 'Sacha', true)
on conflict (email) do nothing;

-- Le parcours : les dates et les titres, jamais les vidéos.
create or replace function public.espace() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.eleves;
begin
  select * into e from public.eleves where email = lower(auth.jwt() ->> 'email');
  if not found then
    raise exception 'pas_inscrit';
  end if;
  return jsonb_build_object(
    'prenom', e.prenom,
    'staff', e.staff,
    'maintenant', now(),
    'jours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'numero', j.numero,
        'titre', j.titre,
        'ouvre_le', j.ouvre_le,
        'ouvert', j.ouvre_le <= now()
      ) order by j.numero)
      from public.jours j
    ), '[]'::jsonb)
  );
end $$;

-- Un jour : son contenu seulement s'il est ouvert (ou pour le staff).
create or replace function public.espace_jour(n int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.eleves;
  j public.jours;
begin
  select * into e from public.eleves where email = lower(auth.jwt() ->> 'email');
  if not found then
    raise exception 'pas_inscrit';
  end if;
  select * into j from public.jours where numero = n;
  if not found then
    raise exception 'jour_inconnu';
  end if;
  if j.ouvre_le > now() and not e.staff then
    return jsonb_build_object(
      'numero', j.numero, 'titre', j.titre, 'ouvre_le', j.ouvre_le,
      'ouvert', false, 'maintenant', now()
    );
  end if;
  return jsonb_build_object(
    'numero', j.numero, 'titre', j.titre, 'ouvre_le', j.ouvre_le,
    'objectif', j.objectif, 'video', j.video,
    'taches', j.taches, 'ressources', j.ressources, 'encart', j.encart,
    'prompts', j.prompts,
    'ouvert', j.ouvre_le <= now(),
    'apercu', j.ouvre_le > now(),
    'maintenant', now()
  );
end $$;

revoke all on function public.espace() from public, anon;
revoke all on function public.espace_jour(int) from public, anon;
grant execute on function public.espace() to authenticated;
grant execute on function public.espace_jour(int) to authenticated;

-- Le dossier : ce que l'élève sait de son app et de sa cible, rempli au fil
-- des jours. Une ligne par élève, lue et écrite seulement par ces fonctions.
create table if not exists public.dossiers (
  email      text primary key references public.eleves (email) on update cascade on delete cascade,
  donnees    jsonb not null default '{}'::jsonb,
  modifie_le timestamptz not null default now()
);
alter table public.dossiers enable row level security;

create or replace function public.dossier() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.eleves;
  d public.dossiers;
begin
  select * into e from public.eleves where email = lower(auth.jwt() ->> 'email');
  if not found then
    raise exception 'pas_inscrit';
  end if;
  select * into d from public.dossiers where email = e.email;
  return jsonb_build_object('donnees', coalesce(d.donnees, '{}'::jsonb), 'modifie_le', d.modifie_le);
end $$;

-- Enregistre les champs reçus par-dessus ceux déjà là. Les autres ne bougent pas.
create or replace function public.dossier_enregistrer(champs jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.eleves;
  nouveau jsonb;
begin
  select * into e from public.eleves where email = lower(auth.jwt() ->> 'email');
  if not found then
    raise exception 'pas_inscrit';
  end if;
  if champs is null or jsonb_typeof(champs) <> 'object' then
    raise exception 'dossier_invalide';
  end if;
  select coalesce((select donnees from public.dossiers where email = e.email), '{}'::jsonb) || champs into nouveau;
  if length(nouveau::text) > 200000 then
    raise exception 'dossier_trop_long';
  end if;
  insert into public.dossiers (email, donnees) values (e.email, nouveau)
  on conflict (email) do update set donnees = excluded.donnees, modifie_le = now();
  return jsonb_build_object('modifie_le', now());
end $$;

revoke all on function public.dossier() from public, anon;
revoke all on function public.dossier_enregistrer(jsonb) from public, anon;
grant execute on function public.dossier() to authenticated;
grant execute on function public.dossier_enregistrer(jsonb) to authenticated;

-- Une adresse hors de la liste ne reçoit aucun code.
create or replace function public.hook_avant_inscription(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.eleves where email = lower(event -> 'user' ->> 'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'pas_inscrit'));
end $$;

revoke all on function public.hook_avant_inscription(jsonb) from public, anon, authenticated;
grant execute on function public.hook_avant_inscription(jsonb) to supabase_auth_admin;
