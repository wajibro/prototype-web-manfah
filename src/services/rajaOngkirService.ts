import Config from '../../config/index.js';

const BASE_URL = Config.RAJAONGKIR_BASE_URL.replace(/\/$/, '');
const API_KEY = Config.RAJAONGKIR_API_KEY;

// ============================================================
// Helper request ke Komerce RajaOngkir API v1
// ============================================================
async function rajaFetch(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        Key: API_KEY,
        ...(options.headers || {}),
      },
    });
  } catch (err: any) {
    throw new Error(`Network error ke ${url}: ${err.message}`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Response bukan JSON (HTTP ${res.status}) dari ${url}`);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[RAJAONGKIR] ${path} → HTTP ${res.status}`, {
      meta: json?.meta,
      dataCount: Array.isArray(json?.data) ? json.data.length : undefined,
    });
  }

  if (!res.ok) {
    const desc = json?.meta?.message || `HTTP ${res.status}`;
    throw new Error(`RajaOngkir HTTP ${res.status}: ${desc}`);
  }

  const meta = json?.meta;
  if (!meta || meta.code !== 200 || meta.status !== 'success') {
    const code = meta?.code || 'unknown';
    const desc = meta?.message || 'Tidak ada deskripsi error';
    throw new Error(`RajaOngkir error ${code}: ${desc}`);
  }

  return json;
}

// ============================================================
// GET /destination/province
// ============================================================
export const getProvinces = async () => {
  const json = await rajaFetch('/destination/province');
  return (json.data || []) as Array<{
    id: number;
    name: string;
  }>;
};

// ============================================================
// GET /destination/city/{province_id}
// ============================================================
export const getCities = async (provinceId: string) => {
  const json = await rajaFetch(`/destination/city/${provinceId}`);
  return (json.data || []) as Array<{
    id: number;
    name: string;
  }>;
};

// ============================================================
// GET /destination/district/{city_id}
// Mengembalikan kecamatan + zip_code
// ============================================================
export const getDistricts = async (cityId: string) => {
  const json = await rajaFetch(`/destination/district/${cityId}`);
  return (json.data || []) as Array<{
    id: number;
    name: string;
    zip_code: string;
  }>;
};

// ============================================================
// GET /destination/sub-district/{district_id}
// Opsional — hanya jika butuh tingkat kelurahan
// ============================================================
export const getSubDistricts = async (districtId: string) => {
  const json = await rajaFetch(`/destination/sub-district/${districtId}`);
  return (json.data || []) as Array<{
    id: number;
    name: string;
    zip_code: string;
  }>;
};

// ============================================================
// POST /calculate/district/domestic-cost
// Body: origin, destination (district id), weight, courier, price
// ============================================================
export const getShippingCost = async (params: {
  origin: string;
  destination: string;
  weight: number;
  courier: string;
  price?: 'lowest' | 'highest';
}) => {
  const body = new URLSearchParams({
    origin: params.origin,
    destination: params.destination,
    weight: String(params.weight),
    courier: params.courier,
    price: params.price || 'lowest',
  });

  const json = await rajaFetch('/calculate/district/domestic-cost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  return (json.data || []) as Array<{
    name: string;
    code: string;
    service: string;
    description: string;
    cost: number;
    etd: string;
  }>;
};