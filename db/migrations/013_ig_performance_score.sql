-- Score de performance real do Instagram (calculado após coletar Insights)
-- Atualizado automaticamente pelo endpoint /api/insights/collect
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS instagram_performance_score numeric;

COMMENT ON COLUMN content_items.instagram_performance_score IS
  'Score derivado de métricas reais do Instagram (reach + engagement_rate). '
  'Nulo = ainda sem dados. Usado no score híbrido de agendamento.';
