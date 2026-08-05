import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@compras-hub/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddProductSupplierDto } from './dto/add-product-supplier.dto';
import { UpdateProductSupplierDto } from './dto/update-product-supplier.dto';
import { DEFAULT_PAGE_SIZE } from '@compras-hub/shared';

export interface ListProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoria?: string;
  active?: boolean;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListProductsParams) {
    const {
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
      search,
      categoria,
      active,
    } = params;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { categoria: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoria) {
      where.categoria = categoria;
    }

    if (active !== undefined) {
      where.active = active;
    }

    const [data, total] = await Promise.all([
      this.prisma.extended.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.extended.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.extended.product.findFirst({
      where: { id },
      include: {
        suppliers: {
          include: {
            supplier: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(dto: CreateProductDto, userId: string) {
    return this.prisma.extended.product.create({
      data: {
        nome: dto.nome,
        categoria: dto.categoria,
        unidade: dto.unidade,
        precoReferencia: new Prisma.Decimal(dto.precoReferencia),
        createdById: userId,
        updatedById: userId,
      } as any,
    });
  }

  async update(id: string, dto: UpdateProductDto, userId: string) {
    // Verify product exists within tenant scope
    const existing = await this.prisma.extended.product.findFirst({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const data: Prisma.ProductUpdateInput = {
      updatedById: userId,
    };

    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.categoria !== undefined) data.categoria = dto.categoria;
    if (dto.unidade !== undefined) data.unidade = dto.unidade;
    if (dto.precoReferencia !== undefined) {
      data.precoReferencia = new Prisma.Decimal(dto.precoReferencia);
    }

    return this.prisma.extended.product.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    // Verify product exists within tenant scope
    const existing = await this.prisma.extended.product.findFirst({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    // Check if there are linked order items
    const linkedOrderItems = await this.prisma.orderItem.count({
      where: { productId: id },
    });

    if (linkedOrderItems > 0) {
      // Soft-delete: set active = false
      return this.prisma.extended.product.update({
        where: { id },
        data: { active: false },
      });
    }

    // Hard-delete: remove product and cascade ProductSupplier associations
    await this.prisma.productSupplier.deleteMany({
      where: { productId: id },
    });

    return this.prisma.extended.product.delete({
      where: { id },
    });
  }

  /**
   * Associate a supplier with the product at a given price.
   * Validates supplier exists within the same tenant, and that the
   * product-supplier association does not already exist.
   */
  async addSupplier(productId: string, dto: AddProductSupplierDto) {
    // Verify product exists within tenant scope
    const product = await this.prisma.extended.product.findFirst({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify supplier exists within the same tenant
    const supplier = await this.prisma.extended.supplier.findFirst({
      where: { id: dto.supplierId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Check for existing association
    const existing = await this.prisma.productSupplier.findUnique({
      where: {
        productId_supplierId: {
          productId,
          supplierId: dto.supplierId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Product-supplier association already exists');
    }

    return this.prisma.productSupplier.create({
      data: {
        productId,
        supplierId: dto.supplierId,
        price: new Prisma.Decimal(dto.price),
      },
    });
  }

  /**
   * Update the price of an existing product-supplier association.
   */
  async updateSupplierPrice(
    productId: string,
    supplierId: string,
    dto: UpdateProductSupplierDto,
  ) {
    // Verify product exists within tenant scope
    const product = await this.prisma.extended.product.findFirst({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify association exists
    const association = await this.prisma.productSupplier.findUnique({
      where: {
        productId_supplierId: {
          productId,
          supplierId,
        },
      },
    });

    if (!association) {
      throw new NotFoundException('Product-supplier association not found');
    }

    return this.prisma.productSupplier.update({
      where: {
        productId_supplierId: {
          productId,
          supplierId,
        },
      },
      data: {
        price: new Prisma.Decimal(dto.price),
      },
    });
  }

  /**
   * Remove a product-supplier association.
   */
  async removeSupplier(productId: string, supplierId: string) {
    // Verify product exists within tenant scope
    const product = await this.prisma.extended.product.findFirst({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify association exists
    const association = await this.prisma.productSupplier.findUnique({
      where: {
        productId_supplierId: {
          productId,
          supplierId,
        },
      },
    });

    if (!association) {
      throw new NotFoundException('Product-supplier association not found');
    }

    return this.prisma.productSupplier.delete({
      where: {
        productId_supplierId: {
          productId,
          supplierId,
        },
      },
    });
  }
}
