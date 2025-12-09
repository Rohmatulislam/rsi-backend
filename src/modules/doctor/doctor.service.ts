import { Injectable } from '@nestjs/common';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { PrismaService } from 'src/infra/database/prisma.service';
import { DoctorSortBy, GetDoctorsDto } from './dto/get-doctors.dto';

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDoctorDto: CreateDoctorDto) {
    return await this.prisma.doctor.create({
      data: createDoctorDto,
    });
  }

  async findAll(getDoctorsDto: GetDoctorsDto) {

    switch (getDoctorsDto.sort) {
      case DoctorSortBy.RECOMMENDED:
        return this.getRecommendedDoctors(getDoctorsDto.limit);
      default:
        const doctors = await this.prisma.doctor.findMany({
          take: getDoctorsDto.limit,
          select: {
            id: true,
            name: true,
            slug: true,
            specialization: true,
            consultation_fee: true,
            is_executive: true,
            imageUrl: true,
            department: true,
            schedules: {
              select: {
                dayOfWeek: true,
                startTime: true,
                endTime: true,
              }
            },
            categories: {
              select: {
                name: true,
              },
            },
          },
        });
    }
  }

  // TODO: Implement recommended doctors algorithm
  private async getRecommendedDoctors(limit: number) {
  const doctors = await this.prisma.doctor.findMany({
    take: limit,
    select: {
    id: true,
    name: true,
    slug: true,
    specialization: true,
    consultation_fee: true,
    is_executive: true,
    bpjs: true,
    imageUrl: true,
    department: true,
    schedules: {
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
      }
    },
    categories: {
      select: {
        name: true,
      },
    },
  },

  });
  return doctors;
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
