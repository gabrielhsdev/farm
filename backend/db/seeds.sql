-- =============================================================
-- SEEDS.SQL — Dados iniciais obrigatórios
-- Execute após schema.sql
-- =============================================================

-- -------------------------------------------------------------
-- CATEGORIAS DE PRODUTO  (RF06)
-- 8 categorias representativas da agricultura familiar brasileira
-- -------------------------------------------------------------
INSERT OR IGNORE INTO categorias (nome) VALUES
    ('Frutas'),
    ('Verduras e Folhosas'),
    ('Legumes e Raízes'),
    ('Grãos e Cereais'),
    ('Laticínios e Ovos'),
    ('Mel e Derivados'),
    ('Conservas e Processados'),
    ('Ervas e Temperos');

-- -------------------------------------------------------------
-- FORMAS DE PAGAMENTO  (RF13)
-- 5 opções adequadas ao contexto de pequenos produtores
-- -------------------------------------------------------------
INSERT OR IGNORE INTO formas_pagamento (nome) VALUES
    ('Dinheiro'),
    ('PIX'),
    ('Cartão de Débito'),
    ('Cartão de Crédito'),
    ('Transferência Bancária');