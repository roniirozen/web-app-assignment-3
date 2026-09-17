const schemas = require('../config/schemas');

exports.game = (req, res) => res.render('index', { title: 'The API playground', page: 'game' });
exports.schemas = (req, res) => res.render('schemas', { title: 'Resource schemas', page: 'schemas', schemas });
