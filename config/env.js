require('dotenv').config();

const REQUIRED = [
  'DB_URI',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_SECRET',
  'JWT_REFRESH_EXPIRES_IN',
];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Check your .env file against .env.example and set all required values.');
  process.exit(1);
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '3000', 10);

if (Number.isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`[FATAL] PORT must be a valid port number (1-65535), got: ${process.env.PORT}`);
  process.exit(1);
}

const config = {
  port: PORT,
  nodeEnv: NODE_ENV,
  isProduction: NODE_ENV === 'production',
  db: {
    uri: process.env.DB_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },
};

module.exports = config;
