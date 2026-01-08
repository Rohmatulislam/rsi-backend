import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DoctorModule } from './modules/doctor/doctor.module';
import { DatabaseModule } from './infra/database/database.module';
import { SupabaseModule } from './infra/supabase/supabase.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { ReminderModule } from './modules/reminder/reminder.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule as AppAuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './infra/auth/auth';
import { ScheduleModule } from '@nestjs/schedule';
import { ArticleModule } from './modules/article/articles.module';
import { AboutModule } from './modules/about/about.module';
import { UserModule } from './modules/user/user.module';
import { ServiceModule } from './modules/service/service.module';
import { McuModule } from './modules/mcu/mcu.module';
import { LabModule } from './modules/lab/lab.module';
import { RadiologiModule } from './modules/radiologi/radiologi.module';
import { InpatientModule } from './modules/inpatient/inpatient.module';
import { FarmasiModule } from './modules/farmasi/farmasi.module';
import { RehabilitationModule } from './modules/rehabilitation/rehabilitation.module';
import { BannerModule } from './modules/banner/banner.module';
import { UploadModule } from './modules/upload/upload.module';
import { ChatModule } from './modules/chat/chat.module';
import { CategoryModule } from './modules/category/category.module';
import { StatsModule } from './modules/stats/stats.module';
import { PartnerModule } from './modules/partner/partner.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    SupabaseModule,
    AuthModule.forRoot({
      auth: auth,
    }),
    DoctorModule,
    DatabaseModule,
    AppointmentModule,
    ReminderModule,
    AdminModule,
    AppAuthModule,
    ArticleModule,
    AboutModule,
    UserModule,
    ServiceModule,
    McuModule,
    LabModule,
    RadiologiModule,
    InpatientModule,
    FarmasiModule,
    RehabilitationModule,
    BannerModule,
    UploadModule,
    ChatModule,
    CategoryModule,
    StatsModule,
    PartnerModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
