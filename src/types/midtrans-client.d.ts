declare module 'midtrans-client' {
  const midtransClient: {
    Snap: new (options: {
      isProduction: boolean;
      serverKey: string;
      clientKey?: string;
    }) => {
      createTransaction: (parameter: any) => Promise<{
        token: string;
        redirect_url: string;
      }>;
    };

    CoreApi: new (options: {
      isProduction: boolean;
      serverKey: string;
      clientKey?: string;
    }) => {
      transaction: {
        status: (orderId: string) => Promise<any>;
        notification: (payload: any) => Promise<any>;
      };
    };
  };

  export = midtransClient;
}