import { Injectable, Logger } from '@nestjs/common';
import * as midtransClient from 'midtrans-client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);
    private snap: any;

    constructor(private configService: ConfigService) {
        this.snap = new midtransClient.Snap({
            isProduction: this.configService.get<string>('MIDTRANS_IS_PRODUCTION') === 'true',
            serverKey: this.configService.get<string>('MIDTRANS_SERVER_KEY'),
            clientKey: this.configService.get<string>('MIDTRANS_CLIENT_KEY'),
        });
    }

    async createTransaction(params: {
        orderId: string;
        grossAmount: number;
        customerDetails: {
            firstName: string;
            lastName?: string;
            email?: string;
            phone?: string;
        };
        itemDetails?: any[];
    }) {
        try {
            const parameter = {
                transaction_details: {
                    order_id: params.orderId,
                    gross_amount: params.grossAmount,
                },
                customer_details: {
                    first_name: params.customerDetails.firstName,
                    last_name: params.customerDetails.lastName || '',
                    email: params.customerDetails.email,
                    phone: params.customerDetails.phone,
                },
                item_details: params.itemDetails,
                usage_limit: 1,
            };

            const transaction = await this.snap.createTransaction(parameter);
            return transaction;
        } catch (error) {
            this.logger.error(`Error creating Midtrans transaction: ${error.message}`);
            throw error;
        }
    }

    async verifyWebhook(notification: any) {
        try {
            const statusResponse = await this.snap.transaction.notification(notification);
            const orderId = statusResponse.order_id;
            const transactionStatus = statusResponse.transaction_status;
            const fraudStatus = statusResponse.fraud_status;

            this.logger.log(`Transaction notification received. Order ID: ${orderId}. Status: ${transactionStatus}. Fraud Status: ${fraudStatus}`);

            return statusResponse;
        } catch (error) {
            this.logger.error(`Error verifying Midtrans webhook: ${error.message}`);
            throw error;
        }
    }
}
