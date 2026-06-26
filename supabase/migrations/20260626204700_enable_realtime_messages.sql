-- Required for ChatScreen's postgres_changes subscription to receive
-- INSERT events on the messages table.
alter publication supabase_realtime add table public.messages;
