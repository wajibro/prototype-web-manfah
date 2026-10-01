import type { Request, Response, NextFunction } from 'express';
import { selectTable } from '../services/supabaseService';

const maskWord = (word: string): string => {
  if (!word) return '';
  if (word.length <= 2) return word;
  return word.slice(0, 2) + '*'.repeat(word.length - 3);
};

const maskText = (text: string | null | undefined): string => {
  if (!text) return '';
  return String(text)
    .split(/(\s+)/)
    .map((part) => (/\s/.test(part) ? part : maskWord(part)))
    .join('');
};

export const checkOrderPage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orderId = String(req.query.order_id || '').trim();
    let order: any = null;
    let notFound = false;

    if (orderId) {
      const rows = await selectTable('transactions', {
        eqCol: 'order_id',
        eqRow: orderId,
      });

      if (rows && rows.length > 0) {
        order = rows[0];
      } else {
        notFound = true;
      }
    }

    let masked: any = null;
    if (order) {
      const shipping = order.data_pengiriman || {};

      // ---------------------------------------------------------
      // Enrich items dengan nama produk dari tabel `products`
      // ---------------------------------------------------------
      const rawItems: Array<{ id_product: string | number; quantity: number }> =
        Array.isArray(order.items) ? order.items : [];

      const productIds = [...new Set(rawItems.map((it) => String(it.id_product)))];
      const products =
        productIds.length > 0
          ? await selectTable('products', { select: 'id_product, nama, harga, image_url' })
          : [];

      const productMap = new Map<string, any>(
        (products || []).map((p: any) => [String(p.id_product), p])
      );

      const items = rawItems.map((it) => {
        const product = productMap.get(String(it.id_product));
        const price = product ? Number(product.harga) : 0;
        const quantity = Number(it.quantity) || 0;

        return {
          id_product: String(it.id_product),
          name: product?.nama ?? '(Produk tidak ditemukan)',
          image_url: product?.image_url ?? null,
          price,
          quantity,
          subtotal: price * quantity,
        };
      });

      // ---------------------------------------------------------
      // Bangun objek masked untuk view
      // ---------------------------------------------------------
      masked = {
        order_id: order.order_id,
        status: order.status_pembayaran,
        status_order: order.status_order || 'menunggu konfirmasi dari penjual',
        resi: order.resi || '-', 
        gross_amount: order.total_pembayaran,
        created_at: order.created_at,
        updated_at: order.updated_at,
        payment_type: order.metode_pembayaran || null,
        transaction_id: order.transaction_id || null,
        snap_redirect_url: order.snap_redirect_url || null,
        shipping: {
          recipient_name: maskText(shipping.recipient_name),
          phone: maskText(shipping.phone),
          email: maskText(shipping.email),
          address: maskText(shipping.address),
          city_name: shipping.city_name || '',
          province_name: shipping.province_name || '',
          postal_code: shipping.postal_code || '',
          courier: shipping.courier || '',
          courier_service: shipping.courier_service || '',
          shipping_cost: order.ongkir || 0,
        },
        items,
      };
    }

    res.render('cekPesanan', {
      orderId,
      order: masked,
      notFound,
    });
  } catch (error) {
    next(error);
  }
};