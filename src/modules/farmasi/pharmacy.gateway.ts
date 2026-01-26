import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    cors: {
        origin: '*', // Adjust for production security if needed
    },
    namespace: 'pharmacy',
})
export class PharmacyGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('PharmacyGateway');

    @SubscribeMessage('join-queue-room')
    handleJoinRoom(client: Socket): void {
        client.join('pharmacy-queue');
        this.logger.log(`Client ${client.id} joined pharmacy-queue room`);
    }

    broadcastPrescriptionReady(data: {
        no_resep: string;
        nama_pasien: string;
        no_rawat: string;
    }) {
        this.logger.log(`Broadcasting prescription ready for: ${data.nama_pasien}`);
        this.server.to('pharmacy-queue').emit('prescription-ready', data);
    }

    afterInit(server: Server) {
        this.logger.log('Pharmacy WebSocket Gateway initialized');
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    handleConnection(client: Socket, ...args: any[]) {
        this.logger.log(`Client connected: ${client.id}`);
    }
}
