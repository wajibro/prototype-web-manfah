import type { Request, Response, NextFunction } from 'express';
import { selectTable, insertTable, updateTable } from '../services/supabaseService';
import { buildCartResponse } from '../services/productService';
import { createSnapTransaction } from '../services/midtransService';
import type { CartCookieItem } from '../types/cart';

const COOKIE_NAME = 'cart';
const SHIPPING_COOKIE = 'shipping';
const MAX_AGE = 1000 * 60 * 60 * 24 * 7;

// ============================================================
// Helper cookie cart
// ============================================================
const readCart = (req: Request): CartCookieItem[] => {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((i: any) => ({
        id_product: String(i.id_product),
        quantity: Number(i.quantity),
      }))
      .filter((i) => i.id_product && Number.isInteger(i.quantity) && i.quantity > 0);
  } catch {
    return [];
  }
};

const writeCart = (res: Response, items: CartCookieItem[]): void => {
  res.cookie(COOKIE_NAME, JSON.stringify(items), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
};

// ============================================================
// GET /cart
// ============================================================
export const cartPage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const items = readCart(req);
    const { items: merged, totalItems, totalPrice } = await buildCartResponse(items);

    let shipping: any = null;
    try {
      if (req.cookies?.[SHIPPING_COOKIE]) {
        shipping = JSON.parse(req.cookies[SHIPPING_COOKIE]);
      }
    } catch { /* ignore */ }

    res.render('cart', {
      items: merged,
      totalItems,
      totalPrice,
      shipping,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /cart/add
// ============================================================
export const addToCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const idProduct = String(req.body.id_product || '').trim();
    const qty = Math.max(1, parseInt(String(req.body.quantity || '1'), 10));

    if (!idProduct) {
      res.status(400).json({ success: false, message: 'id_product wajib' });
      return;
    }

    const items = readCart(req);
    const found = items.find((i) => i.id_product === idProduct);

    if (found) {
      found.quantity += qty;
    } else {
      items.push({ id_product: idProduct, quantity: qty });
    }

    writeCart(res, items);

    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      res.redirect(req.get('referer') || '/product');
      return;
    }

    res.json({ success: true, items });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /cart/update
// ============================================================
export const updateCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const idProduct = String(req.body.id_product || '');
    const qty = parseInt(String(req.body.quantity || '0'), 10);

    let items = readCart(req);

    if (qty <= 0) {
      items = items.filter((i) => i.id_product !== idProduct);
    } else {
      const found = items.find((i) => i.id_product === idProduct);
      if (found) found.quantity = qty;
    }

    writeCart(res, items);
    res.redirect('/cart');
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /cart/remove
// ============================================================
export const removeFromCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const idProduct = String(req.body.id_product || '');
    const items = readCart(req).filter((i) => i.id_product !== idProduct);
    writeCart(res, items);
    res.redirect('/cart');
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /cart/set
// ============================================================
export const setCartQuantity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const idProduct = String(req.body.id_product || '').trim();
    const qty = parseInt(String(req.body.quantity || '0'), 10);

    if (!idProduct || Number.isNaN(qty)) {
      res.status(400).json({ success: false, message: 'Parameter tidak valid' });
      return;
    }

    let items = readCart(req);

    if (qty <= 0) {
      items = items.filter((i) => i.id_product !== idProduct);
    } else {
      const found = items.find((i) => i.id_product === idProduct);
      if (found) {
        found.quantity = qty;
      } else {
        items.push({ id_product: idProduct, quantity: qty });
      }
    }

    writeCart(res, items);

    const { items: merged, totalItems, totalPrice } = await buildCartResponse(items);

    res.json({
      success: true,
      items: merged,
      totalItems,
      totalPrice,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /cart/shipping
// ============================================================
export const saveShippingInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      recipient_name,
      phone,
      email,
      address,
      city_id,
      city_name,
      province_id,
      province_name,
      postal_code,
      courier,
      courier_service,
      shipping_cost,
    } = req.body;

    if (!recipient_name || !phone || !address || !city_id || !courier) {
      res.status(400).json({
        success: false,
        message: 'Data penerima tidak lengkap',
      });
      return;
    }

    const shippingData = {
      recipient_name: String(recipient_name).trim(),
      phone: String(phone).trim(),
      email: String(email || '').trim(),
      address: String(address).trim(),
      city_id: String(city_id),
      city_name: String(city_name || ''),
      province_id: String(province_id || ''),
      province_name: String(province_name || ''),
      postal_code: String(postal_code || ''),
      courier: String(courier),
      courier_service: String(courier_service || ''),
      shipping_cost: Number(shipping_cost) || 0,
    };

    res.cookie(SHIPPING_COOKIE, JSON.stringify(shippingData), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60,
      path: '/',
    });

    res.json({ success: true, shipping: shippingData });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// POST /cart/checkout
// ============================================================
export const checkoutCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const items = readCart(req);

    if (items.length === 0) {
      res.status(400).json({ success: false, message: 'Cart kosong' });
      return;
    }

    const shippingRaw = req.cookies?.[SHIPPING_COOKIE];

    if (!shippingRaw) {
      res.status(400).json({
        success: false,
        message: 'Data penerima belum diisi',
      });
      return;
    }

    let shipping: any;
    try {
      shipping = JSON.parse(shippingRaw);
    } catch {
      res.status(400).json({
        success: false,
        message: 'Data penerima tidak valid',
      });
      return;
    }

    const rows = await selectTable('products', {
      select: 'id_product, nama, harga, Stok, image_url',
    });

    const productMap = new Map<string, any>(
      (rows || []).map((p: any) => [String(p.id_product), p])
    );

    let grossAmount = 0;
    const itemDetails: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.id_product);

      if (!product) {
        res.status(400).json({
          success: false,
          message: `Produk ${item.id_product} tidak ditemukan`,
        });
        return;
      }

      const stock = Number(product.Stok);
      const price = Math.round(Number(product.harga));

      if (stock < item.quantity) {
        res.status(400).json({
          success: false,
          message: `Stok ${product.nama} tinggal ${stock}`,
        });
        return;
      }

      grossAmount += price * item.quantity;

      itemDetails.push({
        id: String(product.id_product),
        name: product.nama,
        price,
        quantity: item.quantity,
      });
    }

    grossAmount = Math.round(grossAmount);

    const shippingCost = Math.round(Number(shipping.shipping_cost) || 0);
    const grandTotal = grossAmount + shippingCost;

    const orderId = `TRX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const finishUrl = `${req.protocol}://${req.get('host')}/cart/success?order_id=${orderId}`;

    await insertTable('transactions', {
      order_id: orderId,
      total_pembayaran: grandTotal,
      status_pembayaran: 'pending',
      status_order: 'menunggu konfirmasi dari penjual',
      resi: '-',
      customer: {
        first_name: shipping.recipient_name,
        email: shipping.email || null,
        phone: shipping.phone,
      },
      items,
      data_pengiriman: shipping,
      ongkir: shippingCost,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });    
    
    const finalItemDetails = [
      ...itemDetails,
      ...(shippingCost > 0
        ? [
            {
              id: 'SHIPPING',
              name: `Ongkir ${shipping.courier?.toUpperCase() || ''} - ${shipping.courier_service || 'REG'}`.trim(),
              price: shippingCost,
              quantity: 1,
            },
          ]
        : []),
    ];

    const snap = await createSnapTransaction({
      orderId,
      grossAmount: grandTotal,
      items: finalItemDetails,
      customer: {
        first_name: shipping.recipient_name,
        email: shipping.email || undefined,
        phone: shipping.phone,
      },
      finishUrl,
    });

    await updateTable(
      'transactions',
      {
        snap_token: snap.token,
        snap_redirect_url: snap.redirect_url,
        updated_at: new Date().toISOString(),
      },
      'order_id',
      orderId
    );

    res.json({
      success: true,
      order_id: orderId,
      gross_amount: grandTotal,
      token: snap.token,
      redirect_url: snap.redirect_url,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET /cart/success
// ============================================================
export const checkoutSuccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orderId = String(req.query.order_id || '');

    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.clearCookie(SHIPPING_COOKIE, { path: '/' });

    const rows = orderId
      ? await selectTable('transactions', { eqCol: 'order_id', eqRow: orderId })
      : [];

    res.render('cart', {
      items: [],
      totalItems: 0,
      totalPrice: 0,
      success: true,
      order: rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
};