
CREATE OR REPLACE FUNCTION public.cross_test_status_allowed(_from text, _to text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _from = _to THEN 'any'
    WHEN _from = 'aberto' AND _to IN ('em_analise','confirmado','descartado') THEN 'dev'
    WHEN _from = 'confirmado' AND _to IN ('em_analise','em_correcao','descartado') THEN 'dev'
    WHEN _from = 'em_analise' AND _to IN ('confirmado','em_correcao','pronto_reteste','descartado') THEN 'dev'
    WHEN _from = 'em_correcao' AND _to IN ('pronto_reteste','em_analise') THEN 'dev'
    WHEN _from = 'reaberto' AND _to IN ('em_analise','em_correcao','pronto_reteste') THEN 'dev'
    WHEN _from = 'pronto_reteste' AND _to IN ('resolvido','reaberto') THEN 'tester'
    WHEN _from = 'resolvido' AND _to = 'reaberto' THEN 'tester'
    WHEN _from = 'descartado' AND _to = 'aberto' THEN 'tester'
    ELSE NULL
  END;
$$;
