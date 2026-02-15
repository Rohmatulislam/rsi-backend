import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../infra/database/prisma.service';

@Controller('payment')
export class PaymentController {
    private readonly logger = new Logger(PaymentController.name);

    constructor(
        private readonly paymentService: PaymentService,
        private readonly prisma: PrismaService
    ) { }

    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async handleWebhook(@Body() notification: any) {
        try {
            const statusResponse = await this.paymentService.verifyWebhook(notification);
            const orderId = statusResponse.order_id;
            const transactionStatus = statusResponse.transaction_status;
            const fraudStatus = statusResponse.fraud_status;

            // Mapping Midtrans status to Prisma enum
            let paymentStatus: 'PAID' | 'UNPAID' | 'EXPIRED' | 'FAILED' | 'REFUNDED' = 'UNPAID';

            if (transactionStatus === 'capture') {
                if (fraudStatus === 'challenge') {
                    paymentStatus = 'UNPAID'; // Still pending review
                } else if (fraudStatus === 'accept') {
                    paymentStatus = 'PAID';
                }
            } else if (transactionStatus === 'settlement') {
                paymentStatus = 'PAID';
            } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
                paymentStatus = 'FAILED';
                if (transactionStatus === 'expire') paymentStatus = 'EXPIRED';
            } else if (transactionStatus === 'pending') {
                paymentStatus = 'UNPAID';
            } else if (transactionStatus === 'refund') {
                paymentStatus = 'REFUNDED';
            }

            // Update DiagnosticOrder
            if (orderId.startsWith('DIAG-')) {
                await this.prisma.diagnosticOrder.update({
                    where: { orderNumber: orderId },
                    data: {
                        paymentStatus: paymentStatus,
                        paymentMethod: statusResponse.payment_type,
                        paymentId: statusResponse.transaction_id,
                        status: paymentStatus === 'PAID' ? 'CONFIRMED' : undefined
                    }
                });
                this.logger.log(`Diagnostic order ${orderId} updated to ${paymentStatus}`);
            }

            return { status: 'success' };
        } catch (error) {
            this.logger.error(`Webhook error: ${error.message}`);
            return { status: 'error', message: error.message };
        }
    }
}
