import { Module } from '@nestjs/common';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
