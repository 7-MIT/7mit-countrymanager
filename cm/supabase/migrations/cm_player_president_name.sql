-- Presiden pemain memakai nama pemain (bukan nama presiden NPC); nama NPC disimpan di gov.npcPresident dan dipulihkan saat jabatan dilepas.
create or replace function cm_president_name() returns trigger language plpgsql as $$
declare nm text; npc text;
begin
  if NEW.president_uid is not null and NEW.president_uid is distinct from OLD.president_uid then
    select name into nm from cm_profiles where uid = NEW.president_uid;
    if nm is not null then
      npc := coalesce(NEW.data #>> '{gov,npcPresident}', case when OLD.president_uid is null then OLD.data #>> '{gov,president}' else null end, NEW.data #>> '{gov,president}');
      NEW.data := jsonb_set(jsonb_set(NEW.data, '{gov,npcPresident}', to_jsonb(npc), true), '{gov,president}', to_jsonb(nm), true);
      NEW.slim := jsonb_set(coalesce(NEW.slim, '{}'::jsonb), '{president}', to_jsonb(nm), true);
    end if;
  elsif NEW.president_uid is null and OLD.president_uid is not null and (NEW.data #>> '{gov,npcPresident}') is not null then
    NEW.data := jsonb_set(NEW.data, '{gov,president}', to_jsonb(NEW.data #>> '{gov,npcPresident}'), true);
    NEW.slim := jsonb_set(coalesce(NEW.slim, '{}'::jsonb), '{president}', to_jsonb(NEW.data #>> '{gov,npcPresident}'), true);
  end if;
  return NEW;
end $$;
drop trigger if exists trg_cm_president_name on cm_countries;
create trigger trg_cm_president_name before update on cm_countries for each row execute function cm_president_name();
