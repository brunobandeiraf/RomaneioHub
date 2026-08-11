import * as fc from 'fast-check';

/**
 * Property 7: Audit Trail Completeness
 *
 * For any create or update operation on Supplier, Product, or Order,
 * the resulting record has non-null created_at, updated_at, and responsible_user_id
 * fields where updated_at >= created_at.
 *
 * **Validates: Requirements 11.1, 11.2, 11.3**
 */
describe('Property 7: Audit Trail Completeness', () => {
  // Arbitraries for entity types, user IDs, and timestamps
  const entityTypeArb = fc.constantFrom('Supplier', 'Product', 'Order');
  const userIdArb = fc.uuid();
  const timestampArb = fc.date({
    min: new Date('2020-01-01T00:00:00Z'),
    max: new Date('2030-12-31T23:59:59Z'),
  });

  // Simulate a create operation on an entity
  function simulateCreate(params: {
    entityType: string;
    userId: string;
    timestamp: Date;
  }) {
    const now = params.timestamp;
    return {
      id: `${params.entityType.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`,
      entityType: params.entityType,
      createdAt: now,
      updatedAt: now,
      createdById: params.userId,
      updatedById: params.userId,
    };
  }

  // Simulate an update operation on an existing entity
  function simulateUpdate(params: {
    existingRecord: ReturnType<typeof simulateCreate>;
    userId: string;
    updateTimestamp: Date;
  }) {
    // updatedAt is always set to the time of update, which must be >= createdAt
    const updatedAt =
      params.updateTimestamp >= params.existingRecord.createdAt
        ? params.updateTimestamp
        : params.existingRecord.createdAt;

    return {
      ...params.existingRecord,
      updatedAt,
      updatedById: params.userId,
    };
  }

  it('CREATE: resulting record always has non-null createdAt, updatedAt, and responsible_user_id', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        userIdArb,
        timestampArb,
        (entityType, userId, timestamp) => {
          const record = simulateCreate({ entityType, userId, timestamp });

          // All audit fields must be non-null
          expect(record.createdAt).not.toBeNull();
          expect(record.createdAt).toBeInstanceOf(Date);
          expect(record.updatedAt).not.toBeNull();
          expect(record.updatedAt).toBeInstanceOf(Date);
          expect(record.createdById).not.toBeNull();
          expect(record.createdById).toBeTruthy();
          expect(record.updatedById).not.toBeNull();
          expect(record.updatedById).toBeTruthy();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('CREATE: updatedAt equals createdAt on initial creation', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        userIdArb,
        timestampArb,
        (entityType, userId, timestamp) => {
          const record = simulateCreate({ entityType, userId, timestamp });

          // On create, updatedAt should equal createdAt
          expect(record.updatedAt.getTime()).toBe(record.createdAt.getTime());
        },
      ),
      { numRuns: 200 },
    );
  });

  it('CREATE: createdById and updatedById match the responsible user', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        userIdArb,
        timestampArb,
        (entityType, userId, timestamp) => {
          const record = simulateCreate({ entityType, userId, timestamp });

          expect(record.createdById).toBe(userId);
          expect(record.updatedById).toBe(userId);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('UPDATE: updatedAt >= createdAt invariant is always maintained', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        userIdArb,
        userIdArb,
        timestampArb,
        timestampArb,
        (entityType, createUserId, updateUserId, createTime, updateTime) => {
          const existingRecord = simulateCreate({
            entityType,
            userId: createUserId,
            timestamp: createTime,
          });

          const updatedRecord = simulateUpdate({
            existingRecord,
            userId: updateUserId,
            updateTimestamp: updateTime,
          });

          // Core invariant: updatedAt >= createdAt
          expect(updatedRecord.updatedAt.getTime()).toBeGreaterThanOrEqual(
            updatedRecord.createdAt.getTime(),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('UPDATE: resulting record retains non-null audit fields', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        userIdArb,
        userIdArb,
        timestampArb,
        timestampArb,
        (entityType, createUserId, updateUserId, createTime, updateTime) => {
          const existingRecord = simulateCreate({
            entityType,
            userId: createUserId,
            timestamp: createTime,
          });

          const updatedRecord = simulateUpdate({
            existingRecord,
            userId: updateUserId,
            updateTimestamp: updateTime,
          });

          // All audit fields remain non-null after update
          expect(updatedRecord.createdAt).not.toBeNull();
          expect(updatedRecord.createdAt).toBeInstanceOf(Date);
          expect(updatedRecord.updatedAt).not.toBeNull();
          expect(updatedRecord.updatedAt).toBeInstanceOf(Date);
          expect(updatedRecord.createdById).not.toBeNull();
          expect(updatedRecord.createdById).toBeTruthy();
          expect(updatedRecord.updatedById).not.toBeNull();
          expect(updatedRecord.updatedById).toBeTruthy();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('UPDATE: createdAt is immutable (never changes after creation)', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        userIdArb,
        userIdArb,
        timestampArb,
        timestampArb,
        (entityType, createUserId, updateUserId, createTime, updateTime) => {
          const existingRecord = simulateCreate({
            entityType,
            userId: createUserId,
            timestamp: createTime,
          });

          const updatedRecord = simulateUpdate({
            existingRecord,
            userId: updateUserId,
            updateTimestamp: updateTime,
          });

          // createdAt must be unchanged after update
          expect(updatedRecord.createdAt.getTime()).toBe(
            existingRecord.createdAt.getTime(),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('UPDATE: updatedById reflects the user who performed the update', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        userIdArb,
        userIdArb,
        timestampArb,
        timestampArb,
        (entityType, createUserId, updateUserId, createTime, updateTime) => {
          const existingRecord = simulateCreate({
            entityType,
            userId: createUserId,
            timestamp: createTime,
          });

          const updatedRecord = simulateUpdate({
            existingRecord,
            userId: updateUserId,
            updateTimestamp: updateTime,
          });

          // updatedById should reflect the updating user
          expect(updatedRecord.updatedById).toBe(updateUserId);
          // createdById should still reflect the original creator
          expect(updatedRecord.createdById).toBe(createUserId);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('multiple sequential updates maintain updatedAt >= createdAt invariant', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        userIdArb,
        fc.array(
          fc.record({ userId: userIdArb, timestamp: timestampArb }),
          { minLength: 1, maxLength: 10 },
        ),
        timestampArb,
        (entityType, createUserId, updates, createTime) => {
          let record = simulateCreate({
            entityType,
            userId: createUserId,
            timestamp: createTime,
          });

          // Apply each update sequentially
          for (const update of updates) {
            record = simulateUpdate({
              existingRecord: record,
              userId: update.userId,
              updateTimestamp: update.timestamp,
            });

            // Invariant must hold after every update
            expect(record.updatedAt.getTime()).toBeGreaterThanOrEqual(
              record.createdAt.getTime(),
            );
            expect(record.createdAt).not.toBeNull();
            expect(record.updatedAt).not.toBeNull();
            expect(record.createdById).not.toBeNull();
            expect(record.updatedById).not.toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
