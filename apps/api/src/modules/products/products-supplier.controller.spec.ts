import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController - Supplier Association Endpoints', () => {
  let controller: ProductsController;
  let service: jest.Mocked<ProductsService>;

  const mockUser = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    globalRole: 'SELLER' as any,
    tenantRole: 'SELLER' as any,
    email: 'user@example.com',
  };

  const mockAssociation = {
    id: 'assoc-1',
    productId: 'product-1',
    supplierId: 'supplier-1',
    price: 25.5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      list: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addSupplier: jest.fn(),
      updateSupplierPrice: jest.fn(),
      removeSupplier: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get(ProductsService);
  });

  describe('POST /products/:id/suppliers', () => {
    it('should call addSupplier with correct parameters', async () => {
      const dto = { supplierId: 'supplier-1', price: 25.5 };
      service.addSupplier.mockResolvedValue(mockAssociation as any);

      const result = await controller.addSupplier('product-1', dto);

      expect(service.addSupplier).toHaveBeenCalledWith('product-1', dto);
      expect(result).toEqual(mockAssociation);
    });
  });

  describe('PATCH /products/:id/suppliers/:supplierId', () => {
    it('should call updateSupplierPrice with correct parameters', async () => {
      const dto = { price: 30.0 };
      const updated = { ...mockAssociation, price: 30.0 };
      service.updateSupplierPrice.mockResolvedValue(updated as any);

      const result = await controller.updateSupplierPrice(
        'product-1',
        'supplier-1',
        dto,
      );

      expect(service.updateSupplierPrice).toHaveBeenCalledWith(
        'product-1',
        'supplier-1',
        dto,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('DELETE /products/:id/suppliers/:supplierId', () => {
    it('should call removeSupplier with correct parameters', async () => {
      service.removeSupplier.mockResolvedValue(mockAssociation as any);

      await controller.removeSupplier('product-1', 'supplier-1');

      expect(service.removeSupplier).toHaveBeenCalledWith(
        'product-1',
        'supplier-1',
      );
    });
  });
});
