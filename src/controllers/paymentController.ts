import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import Config from '../../config/index.js';
import supabase from '../../config/supabase.js';
import { selectTable, insertTable, updateTable } from '../services/supabaseService';
import { createSnapTransaction, getMidtransStatus } from '../services/midtransService';
import type {
  CreateSnapPaymentBody,
  MidtransNotificationPayload,
} from '../types/paymentTypes';

const buildOrderId = (): string => {
  return `TRX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

// ================================================================
// POST /api/payments/snap
// (opsional — hanya dipakai kalau checkout TIDAK lewat /cart/checkout)
// ================================================================
export const createSnapPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { items, customer } = req.body as CreateSnapPaymentBody;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'items wajib diisi' });
      return;
    }

    const normalizedItems = items
      .map((item) => ({
        id_product: String(item.id_product),
        quantity: Number(item.quantity),
      }))
      .filter(
        (item) =>
          item.id_product &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0
      );

    if (normalizedItems.length === 0) {
      res.status(400).json({ success: false, message: 'Format items tidak valid' });
      return;
    }

    const productIds = [...new Set(normalizedItems.map((i) => i.id_product))];

    const { data: products, error } = await supabase
      .from('products')
      .select('id_product, nama, harga, Stok, image_url')
      .in('id_product', productIds);

    if (error) {
      throw new Error(`Gagal ambil produk: ${error.message}`);
    }

    const productMap = new Map<string, any>(
      (products || []).map((p: any) => [String(p.id_product), p])
    );

    let grossAmount = 0;
    const itemDetails: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }> = [];

    for (const item of normalizedItems) {
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
          message: `Stok ${product.nama} tidak cukup`,
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

    const orderId = buildOrderId();
    const finishUrl = `${req.protocol}://${req.get('host')}/cart/success?order_id=${orderId}`;

    await insertTable('transactions', {
      order_id: orderId,
      total_pembayaran: grossAmount,
      status_pembayaran: 'pending',
      status_order: 'menunggu konfirmasi dari penjual',
      resi: '-',
      customer: customer || null,
      items: normalizedItems,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const snap = await createSnapTransaction({
      orderId,
      grossAmount,
      items: itemDetails,
      customer: customer
        ? { first_name: customer.first_name, email: customer.email, phone: customer.phone }
        : undefined,
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

    res.status(201).json({
      success: true,
      order_id: orderId,
      gross_amount: grossAmount,
      token: snap.token,
      redirect_url: snap.redirect_url,
    });

  } catch (error) {
    next(error);
  }
};

// ================================================================
// POST /api/payments/notification
// Webhook Midtrans
// ================================================================
export const midtransNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = req.body as MidtransNotificationPayload;

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = payload;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      res.status(400).json({
        success: false,
        message: 'Payload notification tidak lengkap',
      });
      return;
    }

    // Verifikasi signature Midtrans (SHA512)
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${Config.MIDTRANS_SERVER_KEY}`)
      .digest('hex');

    if (expectedSignature !== signature_key) {
      res.status(403).json({
        success: false,
        message: 'Signature Midtrans tidak valid',
      });
      return;
    }

    // Ambil transaksi
    const rows = await selectTable('transactions', {
      eqCol: 'order_id',
      eqRow: order_id,
    });

    const trx = rows[0];

    if (!trx) {
      res.status(404).json({
        success: false,
        message: 'Order tidak ditemukan',
      });
      return;
    }

    let newStatus = trx.status_pembayaran;

    if (transaction_status === 'capture') {
      newStatus = fraud_status === 'accept' ? 'paid' : 'challenge';
    } else if (transaction_status === 'settlement') {
      newStatus = 'paid';
    } else if (transaction_status === 'pending') {
      newStatus = 'pending';
    } else if (['deny', 'cancel'].includes(transaction_status)) {
      newStatus = 'failed';
    } else if (transaction_status === 'expire') {
      newStatus = 'expired';
    } else if (
      transaction_status === 'refund' ||
      transaction_status === 'partial_refund'
    ) {
      newStatus = 'refunded';
    }

    const wasPaid = trx.status_pembayaran === 'paid';

    await updateTable(
      'transactions',
      {
        status_pembayaran: newStatus,
        metode_pembayaran: payload.payment_type || null,
        transaction_id: payload.transaction_id || null,
        fraud_status: fraud_status || null,
        raw_notification: payload,
        updated_at: new Date().toISOString(),
      },
      'order_id',
      order_id
    );
    // ---------------------------------------------------------
    // Kurangi stok saat pertama kali berubah menjadi `paid`
    // ---------------------------------------------------------
    if (newStatus === 'paid' && !wasPaid) {
      const items = Array.isArray(trx.items) ? trx.items : [];

      for (const item of items) {
        const productId = String(item.id_product);
        const qty = Number(item.quantity);

        if (!productId || !Number.isInteger(qty) || qty <= 0) continue;

        const products = await selectTable('products', {
          eqCol: 'id_product',
          eqRow: productId,
        });

        const product = products[0];
        if (!product) continue;

        const currentStock = Number(product.Stok || 0);
        const newStock = Math.max(0, currentStock - qty);

        await updateTable(
          'products',
          { Stok: newStock },
          'id_product',
          productId
        );
      }
    }

    res.status(200).json({
      success: true,
      order_id,
      status: newStatus,
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// GET /api/payments/status/:orderId
// ================================================================
export const getPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;

    const rows = await selectTable('transactions', {
      eqCol: 'order_id',
      eqRow: orderId,
    });

    const trx = rows[0];

    if (!trx) {
      res.status(404).json({
        success: false,
        message: 'Order tidak ditemukan',
      });
      return;
    }

    let midtransStatus: any = null;
    try {
      midtransStatus = await getMidtransStatus(orderId);
    } catch {
      midtransStatus = null;
    }

    res.json({
      success: true,
      order: {
        order_id: trx.order_id,
        status: trx.status_pembayaran,
        status_order: trx.status_order,
        gross_amount: trx.total_pembayaran,
        payment_type: trx.metode_pembayaran,
        transaction_id: trx.transaction_id,
        snap_redirect_url: trx.snap_redirect_url,
        customer: trx.customer,
        items: trx.items,
        shipping: trx.data_pengiriman,
        shipping_cost: trx.ongkir,
        created_at: trx.created_at,
        updated_at: trx.updated_at,
      },
      midtrans: midtransStatus,
    });
  } catch (error) {
    next(error);
  }
};