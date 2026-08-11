import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = { url: '/test-path' };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should format BadRequestException with structured validation errors', () => {
    const validationErrors = [
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
      {
        property: 'name',
        constraints: { isNotEmpty: 'name should not be empty' },
      },
    ];
    const exception = new BadRequestException({
      message: 'Validation failed',
      errors: validationErrors,
    });

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('Validation failed');
    expect(body.errors).toEqual(validationErrors);
    expect(body.error).toBe('Bad Request');
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/test-path');
  });

  it('should handle BadRequestException without errors array', () => {
    const exception = new BadRequestException('Something went wrong');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('Something went wrong');
    expect(body.errors).toBeUndefined();
  });

  it('should not include errors field when no validation errors present', () => {
    const exception = new NotFoundException('Resource not found');

    filter.catch(exception, mockHost as any);

    const body = mockResponse.json.mock.calls[0][0];
    expect(body.errors).toBeUndefined();
  });

  it('should return generic message for InternalServerErrorException', () => {
    const exception = new InternalServerErrorException(
      'Database connection failed: password auth failed for user postgres',
    );

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body.error).toBe('Internal Server Error');
    expect(body.path).toBe('/test-path');
    // Must not expose internal details
    expect(JSON.stringify(body)).not.toContain('Database connection failed');
    expect(JSON.stringify(body)).not.toContain('password auth');
  });

  it('should return generic message for unknown/unhandled errors', () => {
    const exception = new Error('Something broke internally');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body.error).toBe('Internal Server Error');
    expect(JSON.stringify(body)).not.toContain('Something broke internally');
  });

  it('should format ForbiddenException without revealing resource details', () => {
    const exception = new ForbiddenException('Forbidden');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(403);
    expect(body.message).toBe('Forbidden');
    expect(body.path).toBe('/test-path');
  });

  it('should format NotFoundException', () => {
    const exception = new NotFoundException('Resource not found');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(404);
    expect(body.message).toBe('Resource not found');
  });

  it('should include timestamp and path in all responses', () => {
    const exception = new ForbiddenException();

    filter.catch(exception, mockHost as any);

    const body = mockResponse.json.mock.calls[0][0];
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.path).toBe('/test-path');
  });
});
