export interface PaymentItemInput {
  id_product: string;
  quantity: number;
}

export interface CreateSnapPaymentBody {
  items: PaymentItemInput[];
  customer?: {
    first_name?: string;
    email?: string;
    phone?: string;
  };
}

export interface MidtransNotificationPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
  [key: string]: any;
}