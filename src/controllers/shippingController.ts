import type { Request, Response, NextFunction } from 'express';
import {
  getProvinces,
  getCities,
  getDistricts,
  getSubDistricts,
  getShippingCost,
} from '../services/rajaOngkirService';
import { selectTable } from '../services/supabaseService';

// ================================================================
// GET /api/shipping/provinces
// ================================================================
export const listProvinces = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const provinces = await getProvinces();
    res.json({ success: true, data: provinces });
  } catch (error: any) {
    console.error('[SHIPPING] listProvinces error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal memuat provinsi',
    });
  }
};

// ================================================================
// GET /api/shipping/cities/:provinceId
// ================================================================
export const listCities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { provinceId } = req.params;
    const cities = await getCities(provinceId);
    res.json({ success: true, data: cities });
  } catch (error: any) {
    console.error('[SHIPPING] listCities error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal memuat kota',
    });
  }
};

// ================================================================
// GET /api/shipping/districts/:cityId
// ================================================================
export const listDistricts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { cityId } = req.params;
    const districts = await getDistricts(cityId);
    res.json({ success: true, data: districts });
  } catch (error: any) {
    console.error('[SHIPPING] listDistricts error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal memuat kecamatan',
    });
  }
};

// ================================================================
// GET /api/shipping/sub-districts/:districtId
// ================================================================
export const listSubDistricts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { districtId } = req.params;
    const subs = await getSubDistricts(districtId);
    res.json({ success: true, data: subs });
  } catch (error: any) {
    console.error('[SHIPPING] listSubDistricts error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal memuat kelurahan',
    });
  }
};

// ================================================================
// POST /api/shipping/cost
// Body: { destination (district id), courier }
// ================================================================
export const calculateShippingCost = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { destination, courier } = req.body;

    if (!destination || !courier) {
      res.status(400).json({
        success: false,
        message: 'destination dan courier wajib diisi',
      });
      return;
    }

    const raw = req.cookies?.cart;
    if (!raw) {
      res.status(400).json({ success: false, message: 'Cart kosong' });
      return;
    }

    const cartItems: Array<{ id_product: string; quantity: number }> =
      JSON.parse(raw);

    if (cartItems.length === 0) {
      res.status(400).json({ success: false, message: 'Cart kosong' });
      return;
    }

    const products = await selectTable('products', {
      select: 'id_product, nama, Berat',
    });

    const productMap = new Map<string, any>(
      (products || []).map((p: any) => [String(p.id_product), p])
    );

    let totalWeight = 0;
    for (const item of cartItems) {
      const product = productMap.get(item.id_product);
      if (!product) continue;

      // Jika Berat null/undefined, default ke 1 gram
      const itemWeight = (product.Berat === null || product.Berat === undefined) 
                        ? 1 
                        : Number(product.Berat);

      totalWeight += itemWeight * item.quantity;
    }

    // Safety net: pastikan total berat minimal 1 gram
    if (totalWeight < 1) totalWeight = 1;

    // ---------------------------------------------------------
    // ORIGIN: ganti dengan DISTRICT ID (kecamatan) asal toko
    // Contoh Kota Malang kecamatan Klojen = district id: 4726
    // ---------------------------------------------------------
    const ORIGIN_DISTRICT_ID = '4726'; // ← GANTI sesuai lokasi tokomu

    const costs = await getShippingCost({
      origin: ORIGIN_DISTRICT_ID,
      destination: String(destination),
      weight: totalWeight,
      courier,
      price: 'lowest',
    });

    res.json({
      success: true,
      total_weight: totalWeight,
      costs,
    });
  } catch (error: any) {
    console.error('[SHIPPING] calculateCost error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal hitung ongkir',
    });
  }
};