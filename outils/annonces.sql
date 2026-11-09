-- ============================================================
-- Le Stage · l'annonce de 6 h sur Discord.
-- Appliquée par outils/brancher-annonces.mjs. On peut la relancer.
--
-- Chaque minute, Supabase regarde si un jour vient d'ouvrir (jours.ouvre_le)
-- et poste son lien dans son salon (jours.salon). C'est la date du verrou :
-- si tu déplaces un jour, son annonce se déplace avec.
--
-- annonce_le se remplit quand Discord a accepté le message. Si Discord
-- refuse, on retente chaque minute pendant 24 h.
-- Pour reposter un jour ouvert depuis moins de 24 h :
--   update jours set annonce_le = null, annonce_requete = null where numero = N;
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.jours add column if not exists salon text;
alter table public.jours add column if not exists annonce_requete bigint;
alter table public.jours add column if not exists annonce_le timestamptz;

create or replace function public.annoncer_jours() returns void
language plpgsql security definer set search_path = '' as $$
declare
  j public.jours;
  rep net._http_response;
  jeton text;
  texte text;
begin
  select decrypted_secret into jeton from vault.decrypted_secrets where name = 'discord_bot_token';
  if jeton is null then
    return;
  end if;

  for j in
    select * from public.jours
    where salon is not null and annonce_le is null
      and ouvre_le <= now() and ouvre_le > now() - interval '1 day'
    order by numero
  loop
    if j.annonce_requete is not null then
      select r.* into rep from net._http_response r where r.id = j.annonce_requete;
      if found then
        if rep.status_code between 200 and 299 then
          update public.jours set annonce_le = now() where numero = j.numero;
          continue;
        end if;
        -- Refusé ou coupé en route : on repart pour un essai ci-dessous.
      elsif exists (select 1 from net.http_request_queue q where q.id = j.annonce_requete) then
        continue; -- encore en route
      end if;
    end if;

    texte := format(
      E'**Jour %s%s**\nTa vidéo : <https://stage.sachaclauzade.me/espace.html?jour=%s>\nTes questions sur ce jour, c''est ici.',
      j.numero, coalesce(' : ' || nullif(trim(j.titre), ''), ''), j.numero
    );

    update public.jours
    set annonce_requete = net.http_post(
      url := format('https://discord.com/api/v10/channels/%s/messages', j.salon),
      body := jsonb_build_object('content', texte, 'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb)),
      headers := jsonb_build_object(
        'Authorization', 'Bot ' || jeton,
        'Content-Type', 'application/json',
        'User-Agent', 'DiscordBot (https://stage.sachaclauzade.me, 1.0)'
      ),
      timeout_milliseconds := 10000
    )
    where numero = j.numero;
  end loop;
end $$;

-- Seul le cron l'appelle : personne ne peut la déclencher depuis le site.
revoke all on function public.annoncer_jours() from public, anon, authenticated;

select cron.schedule('annonces-discord', '* * * * *', 'select public.annoncer_jours()');
