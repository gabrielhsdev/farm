 -- =============================================================
-- SCHEMA.SQL — Marketplace Agricultura Familiar
-- SQLite 3.x | Fase 1
-- =============================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- -------------------------------------------------------------
-- 1. USUÁRIOS
-- Armazena clientes e agricultores numa tabela unificada.
-- role distingue o tipo; campos de agricultor ficam NULL pra clientes.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT    NOT NULL,
    email         TEXT    NOT NULL,
    senha_hash    TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK (role IN ('cliente', 'agricultor')),
    telefone      TEXT,
    created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at    DATETIME          DEFAULT NULL   -- RF04 soft delete
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_email
    ON usuarios (email) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_role
    ON usuarios (role) WHERE deleted_at IS NULL;

-- -------------------------------------------------------------
-- 2. PERFIS DE AGRICULTOR
-- Extensão de usuarios; 1:1 com role='agricultor'.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perfis_agricultor (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id     INTEGER NOT NULL UNIQUE
                   REFERENCES usuarios (id) ON DELETE CASCADE,
    descricao      TEXT,
    cidade         TEXT,
    estado         TEXT    CHECK (length(estado) = 2),
    cep            TEXT,
    latitude       REAL,
    longitude      REAL,
    foto_id        INTEGER REFERENCES imagens (id) ON DELETE SET NULL,
    media_avaliacoes REAL   NOT NULL DEFAULT 0.0
                   CHECK (media_avaliacoes >= 0.0 AND media_avaliacoes <= 5.0),
    total_avaliacoes INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_perfil_cidade
    ON perfis_agricultor (cidade, estado);

-- -------------------------------------------------------------
-- 3. IMAGENS
-- BLOBs servidos via GET /api/imagens/:id.
-- Referenciadas por produtos e perfis.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS imagens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    dados       BLOB    NOT NULL,
    mime_type   TEXT    NOT NULL DEFAULT 'image/jpeg',
    tamanho     INTEGER NOT NULL,  -- bytes
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- -------------------------------------------------------------
-- 4. CATEGORIAS DE PRODUTO  (seed via seeds.sql — RF06)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nome  TEXT    NOT NULL UNIQUE
);

-- -------------------------------------------------------------
-- 5. PRODUTOS  (RF05, RF06)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS produtos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    agricultor_id  INTEGER NOT NULL
                   REFERENCES usuarios (id) ON DELETE CASCADE,
    categoria_id   INTEGER NOT NULL
                   REFERENCES categorias (id) ON DELETE RESTRICT,
    nome           TEXT    NOT NULL,
    descricao      TEXT,
    preco          REAL    NOT NULL CHECK (preco >= 0),
    unidade        TEXT    NOT NULL DEFAULT 'un'
                   CHECK (unidade IN ('un','kg','g','L','mL','dz','cx','mç')),
    estoque        REAL    NOT NULL DEFAULT 0 CHECK (estoque >= 0),
    foto_id        INTEGER REFERENCES imagens (id) ON DELETE SET NULL,
    created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at     DATETIME          DEFAULT NULL  -- RF04 soft delete
);

CREATE INDEX IF NOT EXISTS idx_produtos_agricultor
    ON produtos (agricultor_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_categoria
    ON produtos (categoria_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_nome
    ON produtos (nome) WHERE deleted_at IS NULL;

-- -------------------------------------------------------------
-- 6. CARRINHOS  (RF07)
-- Um carrinho ativo por par (cliente, agricultor).
-- status: 'ativo' | 'snapshot_enviado' | 'abandonado'
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carrinhos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id     INTEGER NOT NULL
                   REFERENCES usuarios (id) ON DELETE CASCADE,
    agricultor_id  INTEGER NOT NULL
                   REFERENCES usuarios (id) ON DELETE CASCADE,
    status         TEXT    NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo','snapshot_enviado','abandonado')),
    created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Garante apenas 1 carrinho ativo por par
CREATE UNIQUE INDEX IF NOT EXISTS ux_carrinho_ativo
    ON carrinhos (cliente_id, agricultor_id)
    WHERE status = 'ativo';

-- -------------------------------------------------------------
-- 7. ITENS DE CARRINHO  (RF07)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS itens_carrinho (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    carrinho_id  INTEGER NOT NULL
                 REFERENCES carrinhos (id) ON DELETE CASCADE,
    produto_id   INTEGER NOT NULL
                 REFERENCES produtos (id) ON DELETE RESTRICT,
    quantidade   REAL    NOT NULL CHECK (quantidade > 0),
    preco_unit   REAL    NOT NULL CHECK (preco_unit >= 0),  -- snapshot do preço no momento
    updated_at   DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_item_carrinho_produto
    ON itens_carrinho (carrinho_id, produto_id);

CREATE INDEX IF NOT EXISTS idx_itens_carrinho
    ON itens_carrinho (carrinho_id);

-- -------------------------------------------------------------
-- 8. CONVERSAS  (RF08, RF12)
-- Única e persistente por par (cliente, agricultor).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id     INTEGER NOT NULL
                   REFERENCES usuarios (id) ON DELETE CASCADE,
    agricultor_id  INTEGER NOT NULL
                   REFERENCES usuarios (id) ON DELETE CASCADE,
    created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_conversa_par
    ON conversas (cliente_id, agricultor_id);

-- -------------------------------------------------------------
-- 9. MENSAGENS  (RF08)
-- tipo: 'texto' | 'snapshot'
-- snapshot_json: preenchido apenas quando tipo='snapshot'
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensagens (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    conversa_id   INTEGER NOT NULL
                  REFERENCES conversas (id) ON DELETE CASCADE,
    remetente_id  INTEGER NOT NULL
                  REFERENCES usuarios (id) ON DELETE CASCADE,
    tipo          TEXT    NOT NULL DEFAULT 'texto'
                  CHECK (tipo IN ('texto','snapshot')),
    conteudo      TEXT,   -- texto livre; NULL quando tipo='snapshot'
    snapshot_json TEXT,   -- JSON serializado; NULL quando tipo='texto'
    carrinho_id   INTEGER REFERENCES carrinhos (id) ON DELETE SET NULL,
    created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Índice principal do polling: mensagens por conversa após timestamp
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_created
    ON mensagens (conversa_id, created_at);

CREATE INDEX IF NOT EXISTS idx_mensagens_remetente
    ON mensagens (remetente_id);

-- Ao menos um dos campos de conteúdo deve estar preenchido
CREATE TABLE IF NOT EXISTS _check_mensagens (  -- enforced via trigger abaixo
    dummy INTEGER
);

-- Trigger: garante que mensagem de texto tem conteudo e snapshot tem snapshot_json
CREATE TRIGGER IF NOT EXISTS trg_mensagem_conteudo_check
BEFORE INSERT ON mensagens
BEGIN
    SELECT CASE
        WHEN NEW.tipo = 'texto'    AND (NEW.conteudo IS NULL OR NEW.conteudo = '')
            THEN RAISE(ABORT, 'Mensagem texto requer conteudo')
        WHEN NEW.tipo = 'snapshot' AND NEW.snapshot_json IS NULL
            THEN RAISE(ABORT, 'Mensagem snapshot requer snapshot_json')
    END;
END;

-- -------------------------------------------------------------
-- 10. FORMAS DE PAGAMENTO  (seed via seeds.sql — RF13)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formas_pagamento (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nome  TEXT    NOT NULL UNIQUE
);

-- -------------------------------------------------------------
-- 11. PEDIDOS  (RF13)
-- Criado pelo agricultor a partir de um snapshot (mensagem).
-- status: 'pendente' | 'confirmado' | 'entregue' | 'cancelado'
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    conversa_id           INTEGER NOT NULL
                          REFERENCES conversas (id) ON DELETE RESTRICT,
    mensagem_snapshot_id  INTEGER NOT NULL
                          REFERENCES mensagens (id) ON DELETE RESTRICT,
    cliente_id            INTEGER NOT NULL
                          REFERENCES usuarios (id) ON DELETE RESTRICT,
    agricultor_id         INTEGER NOT NULL
                          REFERENCES usuarios (id) ON DELETE RESTRICT,
    forma_pagamento_id    INTEGER NOT NULL
                          REFERENCES formas_pagamento (id) ON DELETE RESTRICT,
    status                TEXT    NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','confirmado','entregue','cancelado')),
    total                 REAL    NOT NULL CHECK (total >= 0),
    observacoes           TEXT,
    data_retirada         DATETIME,
    created_at            DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at            DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente
    ON pedidos (cliente_id, status);

CREATE INDEX IF NOT EXISTS idx_pedidos_agricultor
    ON pedidos (agricultor_id, status);

CREATE INDEX IF NOT EXISTS idx_pedidos_conversa
    ON pedidos (conversa_id);

-- -------------------------------------------------------------
-- 12. ITENS DE PEDIDO  (RF13)
-- Desnormalizado: preserva o preço e a descrição do momento da venda.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS itens_pedido (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id    INTEGER NOT NULL
                 REFERENCES pedidos (id) ON DELETE CASCADE,
    produto_id   INTEGER NOT NULL
                 REFERENCES produtos (id) ON DELETE RESTRICT,
    nome_produto TEXT    NOT NULL,  -- snapshot textual do nome
    quantidade   REAL    NOT NULL CHECK (quantidade > 0),
    preco_unit   REAL    NOT NULL CHECK (preco_unit >= 0),
    subtotal     REAL    NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_itens_pedido
    ON itens_pedido (pedido_id);

-- -------------------------------------------------------------
-- 13. AVALIAÇÕES  (RF11)
-- Uma por par (cliente, agricultor), atualizável.
-- Trigger recalcula media_avaliacoes no perfil do agricultor.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avaliacoes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id     INTEGER NOT NULL
                   REFERENCES usuarios (id) ON DELETE CASCADE,
    agricultor_id  INTEGER NOT NULL
                   REFERENCES usuarios (id) ON DELETE CASCADE,
    pedido_id      INTEGER NOT NULL
                   REFERENCES pedidos (id) ON DELETE RESTRICT,
    nota           INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
    comentario     TEXT,
    created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Garante uma avaliação por par cliente-agricultor (atualizável via UPDATE)
CREATE UNIQUE INDEX IF NOT EXISTS ux_avaliacao_par
    ON avaliacoes (cliente_id, agricultor_id);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_agricultor
    ON avaliacoes (agricultor_id);

-- Trigger: recalcula média no perfil do agricultor após INSERT
CREATE TRIGGER IF NOT EXISTS trg_avaliacao_after_insert
AFTER INSERT ON avaliacoes
BEGIN
    UPDATE perfis_agricultor
    SET media_avaliacoes = (
            SELECT ROUND(AVG(CAST(nota AS REAL)), 2)
            FROM avaliacoes WHERE agricultor_id = NEW.agricultor_id
        ),
        total_avaliacoes = (
            SELECT COUNT(*) FROM avaliacoes WHERE agricultor_id = NEW.agricultor_id
        ),
        updated_at = datetime('now')
    WHERE usuario_id = NEW.agricultor_id;
END;

-- Trigger: recalcula média no perfil do agricultor após UPDATE
CREATE TRIGGER IF NOT EXISTS trg_avaliacao_after_update
AFTER UPDATE ON avaliacoes
BEGIN
    UPDATE perfis_agricultor
    SET media_avaliacoes = (
            SELECT ROUND(AVG(CAST(nota AS REAL)), 2)
            FROM avaliacoes WHERE agricultor_id = NEW.agricultor_id
        ),
        total_avaliacoes = (
            SELECT COUNT(*) FROM avaliacoes WHERE agricultor_id = NEW.agricultor_id
        ),
        updated_at = datetime('now')
    WHERE usuario_id = NEW.agricultor_id;
END;

-- =============================================================
-- TABELA AUXILIAR: updated_at automático via trigger
-- (SQLite não tem ON UPDATE automático — usamos triggers)
-- =============================================================
CREATE TRIGGER IF NOT EXISTS trg_usuarios_updated_at
AFTER UPDATE ON usuarios BEGIN
    UPDATE usuarios SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_perfis_updated_at
AFTER UPDATE ON perfis_agricultor BEGIN
    UPDATE perfis_agricultor SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_produtos_updated_at
AFTER UPDATE ON produtos BEGIN
    UPDATE produtos SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_carrinhos_updated_at
AFTER UPDATE ON carrinhos BEGIN
    UPDATE carrinhos SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_conversas_updated_at
AFTER UPDATE ON conversas BEGIN
    UPDATE conversas SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_pedidos_updated_at
AFTER UPDATE ON pedidos BEGIN
    UPDATE pedidos SET updated_at = datetime('now') WHERE id = NEW.id;
END;