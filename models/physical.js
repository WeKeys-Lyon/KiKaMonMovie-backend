const mongoose = require('mongoose');

const physical_formatSchema = new mongoose.Schema({
  name: {type: String, required: true, unique: true},
});

const Physical_format = mongoose.model('physical_format', physical_formatSchema);

module.exports = Physical_format;