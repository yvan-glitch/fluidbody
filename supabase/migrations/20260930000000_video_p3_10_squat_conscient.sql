-- Video Squat conscient I (p3_10, Mobilite), insert deja fait a la main en prod
insert into video_assets (session_id, bunny_path)
values ('p3_10', 'bc784f99-0a0a-4b01-89ca-fad03e72dd8e')
on conflict do nothing;
