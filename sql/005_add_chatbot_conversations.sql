-- Chatbot conversations started (Scalitt). total_chatbot_chats counts bot messages,
-- this is the base for the handoff percentage.
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS chatbot_conversations INTEGER;
