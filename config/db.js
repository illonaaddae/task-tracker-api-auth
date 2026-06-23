const mongoose = require('mongoose');
const config = require('./env');

async function connectDB() {
  await mongoose.connect(config.db.uri);
  console.log(`[DB] Connected to MongoDB: ${mongoose.connection.host}`);
}

module.exports = connectDB;
