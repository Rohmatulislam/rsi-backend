import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

let cachedServer: any;

async function bootstrapServer() {
    if (!cachedServer) {
        const expressApp = express();
        const app = await NestFactory.create(
            AppModule,
            new ExpressAdapter(expressApp),
        );

        app.use(express.json({ limit: '50mb' }));
        app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        app.setGlobalPrefix('api');

        app.useGlobalPipes(
            new ValidationPipe({
                transform: true,
                transformOptions: {
                    enableImplicitConversion: true,
                },
            }),
        );

        const allowedOrigins = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
            : [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:5173',
                'https://rsi-frontend.vercel.app',
            ];

        app.enableCors({
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (
                    allowedOrigins.indexOf(origin) !== -1 ||
                    allowedOrigins.includes('*')
                ) {
                    callback(null, true);
                } else {
                    console.warn(`CORS blocked for origin: ${origin}`);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
            allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With',
        });

        await app.init();
        cachedServer = expressApp;
    }
    return cachedServer;
}

export default async (req: any, res: any) => {
    const server = await bootstrapServer();
    server(req, res);
};
