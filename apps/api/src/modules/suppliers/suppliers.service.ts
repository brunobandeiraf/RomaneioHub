import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@compras-hub/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { DEFAULT_PAGE_SIZE, validateCnpj } from '@compras-hub/shared';

export interface ListSuppliersParams {
  page?: number;
  limit?: number;
  search?: string;
  active?: boolean;
}

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListSuppliersParams) {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      search,
      active,
    } = params;

    const where: Prisma.SupplierWhereInput = {};

    if (search) {
      where.OR = [
        { razaoSocial: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (active !== undefined) {
      where.active = active;
    }

    const [data, total] = await Promise.all([
      this.prisma.extended.supplier.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.extended.supplier.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.extended.supplier.findFirst({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async create(dto: CreateSupplierDto, userId: string) {
    // Validate CNPJ format and check digits
    const cleanedCnpj = dto.cnpj.replace(/[.\-/]/g, '');
    if (!validateCnpj(cleanedCnpj)) {
      throw new BadRequestException('Invalid CNPJ');
    }

    // Check CNPJ uniqueness within tenant
    const existingSupplier = await this.prisma.extended.supplier.findFirst({
      where: { cnpj: cleanedCnpj },
    });

    if (existingSupplier) {
      throw new ConflictException(
        'A supplier with this CNPJ already exists in your organization',
      );
    }

    return this.prisma.extended.supplier.create({
      data: {
        razaoSocial: dto.razaoSocial,
        nomeFantasia: dto.nomeFantasia,
        cnpj: cleanedCnpj,
        contato: dto.contato,
        endereco: dto.endereco
          ? (dto.endereco as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdById: userId,
        updatedById: userId,
      } as any,
    });
  }

  async update(id: string, dto: UpdateSupplierDto, userId: string) {
    // Verify supplier exists within tenant scope
    const existing = await this.prisma.extended.supplier.findFirst({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Supplier not found');
    }

    // If CNPJ is being updated, validate and check uniqueness
    let cleanedCnpj: string | undefined;
    if (dto.cnpj !== undefined) {
      cleanedCnpj = dto.cnpj.replace(/[.\-/]/g, '');
      if (!validateCnpj(cleanedCnpj)) {
        throw new BadRequestException('Invalid CNPJ');
      }

      // Check CNPJ uniqueness (exclude current supplier)
      const duplicateSupplier = await this.prisma.extended.supplier.findFirst({
        where: {
          cnpj: cleanedCnpj,
          id: { not: id },
        },
      });

      if (duplicateSupplier) {
        throw new ConflictException(
          'A supplier with this CNPJ already exists in your organization',
        );
      }
    }

    const data: Prisma.SupplierUpdateInput = {
      updatedById: userId,
    };

    if (dto.razaoSocial !== undefined) data.razaoSocial = dto.razaoSocial;
    if (dto.nomeFantasia !== undefined) data.nomeFantasia = dto.nomeFantasia;
    if (cleanedCnpj !== undefined) data.cnpj = cleanedCnpj;
    if (dto.contato !== undefined) data.contato = dto.contato;
    if (dto.endereco !== undefined) {
      data.endereco = dto.endereco
        ? (dto.endereco as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    return this.prisma.extended.supplier.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    // Verify supplier exists within tenant scope
    const existing = await this.prisma.extended.supplier.findFirst({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Supplier not found');
    }

    // Check if supplier has linked orders
    const linkedOrders = await this.prisma.order.count({
      where: { supplierId: id },
    });

    if (linkedOrders > 0) {
      // Soft-delete: set active = false
      return this.prisma.extended.supplier.update({
        where: { id },
        data: { active: false },
      });
    }

    // Hard-delete: remove supplier and cascade ProductSupplier associations
    await this.prisma.productSupplier.deleteMany({
      where: { supplierId: id },
    });

    return this.prisma.extended.supplier.delete({
      where: { id },
    });
  }
}
