-- Chatbot conversations handed off to support (Scalitt), shown as a % under Chatbot Sent
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS chatbot_handoffs INTEGER;
