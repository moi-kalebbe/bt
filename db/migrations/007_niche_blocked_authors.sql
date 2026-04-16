-- Migration 007: isolar autores bloqueados por nicho

alter table blocked_authors
  add column if not exists niche text not null default 'beach-tennis';

create index if not exists idx_blocked_authors_niche on blocked_authors(niche);
