-- Tabela de ofertas de crédito para MEI
CREATE TABLE IF NOT EXISTS financial.credit_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    title TEXT NOT NULL,
    rate TEXT,
    max_amount TEXT,
    description TEXT,
    url TEXT,
    category TEXT DEFAULT 'giro', -- 'giro', 'investimento', 'cartao', 'antecipacao'
    match_score INTEGER DEFAULT 90,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de alertas e notícias para o Radar do MEI
CREATE TABLE IF NOT EXISTS public.mei_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    source TEXT,
    impact TEXT DEFAULT 'Média',
    category TEXT DEFAULT 'legislacao', -- 'legislacao', 'imposto', 'beneficio', 'prazo'
    url TEXT,
    published_at DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE financial.credit_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Credit offers are public read" ON financial.credit_offers FOR SELECT USING (true);

ALTER TABLE public.mei_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MEI alerts are public read" ON public.mei_alerts FOR SELECT USING (true);

-- Dados iniciais de Crédito
INSERT INTO financial.credit_offers (bank_name, title, rate, max_amount, description, category, match_score, url) VALUES
('BNDES', 'Cartão BNDES MEI', '1.20% a.m.', 'Até R$ 250.000', 'Crédito rotativo para aquisição de máquinas, equipamentos, insumos e serviços.', 'cartao', 97, 'https://www.cartaobndes.gov.br'),
('Caixa Econômica', 'PRONAMPE MEI', '1.49% a.m. + Selic', 'Até R$ 150.000', 'Programa Nacional de Apoio às Microempresas. Garantia pelo FGO.', 'giro', 95, 'https://www.caixa.gov.br'),
('Banco do Brasil', 'BB Giro Digital MEI', '1.59% a.m.', 'Até R$ 100.000', 'Capital de giro 100% digital com aprovação em minutos. Sem garantia real.', 'giro', 93, 'https://www.bb.com.br'),
('BizCapital', 'Giro Rápido', '2.49% a.m.', 'Até R$ 400.000', 'Empréstimo para MEI sem garantia e sem burocracia. Aprovação em 24h.', 'giro', 88, 'https://www.bizcapital.com.br'),
('Sicredi', 'Antecipação de Recebíveis', '1.80% a.m.', 'Conforme faturamento', 'Antecipe as vendas no cartão de crédito e tenha capital imediato.', 'antecipacao', 85, 'https://www.sicredi.com.br'),
('Banco do Nordeste', 'CrediAmigo MEI', '1.05% a.m.', 'Até R$ 21.000', 'Microcrédito produtivo orientado para empreendedores do Nordeste, norte de MG e norte do ES.', 'investimento', 90, 'https://www.bnb.gov.br'),
('Santander', 'Prospera MEI', '1.99% a.m.', 'Até R$ 200.000', 'Linha de crédito exclusiva para MEI com taxas especiais e carência de até 90 dias.', 'giro', 82, 'https://www.santander.com.br'),
('Nubank', 'Empréstimo PJ Nubank', '2.19% a.m.', 'Até R$ 50.000', 'Crédito digital para MEI sem papelada. Simule e contrate pelo app.', 'giro', 80, 'https://www.nubank.com.br');

-- Dados iniciais de Alertas MEI
INSERT INTO public.mei_alerts (title, summary, source, impact, category, published_at, url) VALUES
('Novo limite de faturamento do MEI para 2026', 'O Congresso aprovou o aumento do teto de faturamento anual do MEI de R$ 81.000 para R$ 130.000, válido a partir de janeiro de 2026.', 'Receita Federal', 'Crítica', 'legislacao', '2026-01-15', 'https://www.gov.br/receitafederal'),
('DAS-MEI com reajuste a partir de fevereiro', 'O valor do DAS-MEI foi reajustado para R$ 75,90 (comércio/indústria) e R$ 79,90 (serviços) devido ao novo salário mínimo.', 'Simples Nacional', 'Alta', 'imposto', '2026-02-01', 'https://www8.receita.fazenda.gov.br/simplesnacional'),
('Prazo da DASN-SIMEI encerra em 31 de maio', 'Todos os MEIs devem transmitir a Declaração Anual do Simples Nacional até 31/05/2026. Multa mínima de R$ 50 por atraso.', 'Receita Federal', 'Crítica', 'prazo', '2026-04-01', 'https://www8.receita.fazenda.gov.br/simplesnacional'),
('MEI pode emitir NFS-e nacional gratuita', 'O sistema nacional de emissão de NFS-e para MEI já está disponível gratuitamente pelo portal gov.br, unificando o padrão de notas em todos os municípios.', 'Governo Federal', 'Alta', 'beneficio', '2026-03-10', 'https://www.gov.br/nfse'),
('Novas atividades permitidas para o MEI em 2026', 'A Resolução CGSN incluiu 15 novas ocupações na lista de atividades permitidas ao MEI, incluindo barbeiro, cabeleireiro e técnico de celular.', 'Comitê Gestor do Simples Nacional', 'Média', 'legislacao', '2026-01-20', 'https://www.gov.br/empresas-e-negocios'),
('MEI tem direito a aposentadoria por idade', 'Todo MEI que contribui regularmente com o DAS tem direito à aposentadoria por idade (65 anos homens, 62 mulheres) com valor de 1 salário mínimo.', 'INSS', 'Média', 'beneficio', '2026-05-01', 'https://meu.inss.gov.br'),
('Bloquear cancelamento automático do CNPJ por inatividade', 'MEIs com mais de 12 meses sem emissão de DAS poderão ter o CNPJ cancelado automaticamente a partir de julho de 2026.', 'Receita Federal', 'Crítica', 'prazo', '2026-05-15', 'https://www.gov.br/receitafederal'),
('Programa Acredita: crédito facilitado para MEI', 'O governo federal lançou o Programa Acredita com linhas de crédito especiais para MEI com juros abaixo do mercado e garantia do FGO.', 'Ministério da Fazenda', 'Alta', 'beneficio', '2026-04-20', 'https://www.gov.br/fazenda');
