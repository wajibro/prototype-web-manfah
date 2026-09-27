import dotenv from 'dotenv';
import path from 'path';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

interface AppConfig {
  PORT: number | string;
  SESSION_SECRET: string;
  URL: string;
  KEY: string;
  SESSION_URL: string;
  CORRECT_PIN: string;
  IS_PRODUCTION: boolean;

  MIDTRANS_CLIENT_KEY: string;
  MIDTRANS_SERVER_KEY: string;
  MIDTRANS_IS_PRODUCTION: boolean;

  RAJAONGKIR_API_KEY: string;
  RAJAONGKIR_BASE_URL: string;
}

const Config: AppConfig = {
  PORT: process.env.PORT || 5000,
  SESSION_SECRET: process.env.SESSION_SECRET || '',
  URL: (process.env.DB_URL as string) || '',
  KEY: (process.env.DB_KEY as string) || '',
  SESSION_URL: (process.env.SESSION_URL as string) || '',
  CORRECT_PIN: process.env.CORRECT_PIN || '123',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',

  MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY || '',
  MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || '',
  MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION === 'true',

  RAJAONGKIR_API_KEY: process.env.RAJAONGKIR_API_KEY || '',
  RAJAONGKIR_BASE_URL: process.env.RAJAONGKIR_BASE_URL || 'https://pro.rajaongkir.com/api',
};

if (!Config.URL || !Config.KEY) {
  console.warn('URL atau KEY database tidak ditemukan');
}
if (!Config.MIDTRANS_SERVER_KEY) {
  console.warn('MIDTRANS_SERVER_KEY tidak ditemukan');
}

if (!Config.RAJAONGKIR_API_KEY) {
  console.warn('RAJAONGKIR_API_KEY tidak ditemukan');
}

export default Config;