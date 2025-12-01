import { Injectable } from '@nestjs/common';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { PrismaService } from 'src/infra/database/prisma.service';
import { waitForDebugger } from 'inspector';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}
  create(createDoctorDto: CreateDoctorDto) {
    return 'This action adds a new doctor';
  }

  async findAll() {
    return await this.prisma.doctor.findMany();
  }

  async findOne(id: string) {
    return await this.prisma.doctor.findUnique({
      where: { id },
    });
  }

  update(id: number, updateDoctorDto: UpdateDoctorDto) {
    return `This action updates a #${id} doctor`;
  }

  remove(id: number) {
    return `This action removes a #${id} doctor`;
  }
}
