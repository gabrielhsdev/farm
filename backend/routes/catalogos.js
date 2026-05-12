const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/categorias — RF06
router.get('/categorias', (req, res, next) => {
  try {
    const items = db.prepare(`SELECT id, nome FROM categorias ORDER BY nome ASC`).all();
    res.json(items);
  } catch (err) { next(err); }
});

// GET /api/formas-pagamento — RF13
router.get('/formas-pagamento', requireAuth, (req, res, next) => {
  try {
    const items = db.prepare(`SELECT id, nome FROM formas_pagamento ORDER BY id ASC`).all();
    res.json(items);
  } catch (err) { next(err); }
});

module.exports = router;
