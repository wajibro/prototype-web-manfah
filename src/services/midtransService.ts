import midtransClient from 'midtrans-client';
import Config from '../../config/index.js';

if (!Config.MIDTRANS_SERVER_KEY) {
  console.warn('MIDTRANS_SERVER_KEY tidak ditemukan');
}

const snap = new midtransClient.Snap({
  isProduction: Config.MIDTRANS_IS_PRODUCTION,
  serverKey: Config.MIDTRANS_SERVER_KEY,
  clientKey: Config.MIDTRANS_CLIENT_KEY,
});

const coreApi = new midtransClient.CoreApi({
  isProduction: Config.MIDTRANS_IS_PRODUCTION,
  serverKey: Config.MIDTRANS_SERVER_KEY,
  clientKey: Config.MIDTRANS_CLIENT_KEY,
});

export interface SnapItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface SnapCustomer {
  first_name?: string;
  email?: string;
  phone?: string;
}

export const createSnapTransaction = async (params: {
  orderId: string;
  grossAmount: number;
  items: SnapItem[];
  customer?: SnapCustomer;
  finishUrl?: string;
}) => {
  const parameter: any = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    item_details: params.items,
  };

  if (params.customer) {
    parameter.customer_details = params.customer;
  }

  if (params.finishUrl) {
    parameter.callbacks = {
      finish: params.finishUrl,
    };
  }

  return snap.createTransaction(parameter);
};

export const getMidtransStatus = async (orderId: string) => {
  return coreApi.transaction.status(orderId);
};

export const getMidtransNotification = async (payload: any) => {
  return coreApi.transaction.notification(payload);
};