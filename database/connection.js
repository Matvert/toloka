const mongoose = require('mongoose');

const config = require('../config');

const connection = mongoose.createConnection(config.db, {
  useUnifiedTopology: true,
  useNewUrlParser: true
});;

module.exports = connection;