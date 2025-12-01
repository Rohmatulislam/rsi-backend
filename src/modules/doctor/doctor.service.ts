import { Injectable } from '@nestjs/common';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { PrismaService } from 'src/infra/database/prisma.service';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDoctorDto: CreateDoctorDto) {
    return await this.prisma.doctor.create({
      data: createDoctorDto,
    });
  }

  async findAll() {
    return await this.prisma.doctor.findMany();
  }

  async findOne(id: string) {
    return await this.prisma.doctor.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateDoctorDto: UpdateDoctorDto) {
    return await this.prisma.doctor.update({
      where: { id },
      data: updateDoctorDto,
    });
  }

  async remove(id: string) {
    return await this.prisma.doctor.delete({
      where: { id },
    });
  }
}
