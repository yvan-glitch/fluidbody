-- Video Mobilite & Pilates I (p3_15, Mobilite), insert deja fait a la main en prod
insert into video_assets (session_id, bunny_path)
values ('p3_15', '4f25c4bc-1914-4ea5-8ebd-66d278dded97')
on conflict do nothing;
