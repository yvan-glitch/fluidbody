insert into video_assets (session_id, bunny_path)
values ('p7_5', '2e58a4cd-5dc1-4f2f-a032-135af9094a06')
on conflict (session_id) do nothing;
