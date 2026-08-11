import * as fc from 'fast-check';
import {
  SubscriptionStatus,
  VALID_SUBSCRIPTION_TRANSITIONS,
} from '../../shared/index';

/**
 * Property 5: Subscription State Machine Consistency
 *
 * Subscription status transitions follow valid paths:
 * - TRIAL → ACTIVE or CANCELLED
 * - ACTIVE → PAST_DUE or CANCELLED
 * - PAST_DUE → GRACE_PERIOD or CANCELLED
 * - GRACE_PERIOD → BLOCKED, ACTIVE (renewal), or CANCELLED
 * - BLOCKED → CANCELLED
 * - CANCELLED → (no valid outgoing transitions)
 *
 * **Validates: Requirements 3.4, 3.5, 3.6**
 */

const ALL_STATUSES = Object.values(SubscriptionStatus);

/**
 * Helper: checks if a transition from currentState to targetState is valid
 * according to the VALID_SUBSCRIPTION_TRANSITIONS map.
 */
function isValidTransition(
  currentState: SubscriptionStatus,
  targetState: SubscriptionStatus,
): boolean {
  const validTargets = VALID_SUBSCRIPTION_TRANSITIONS[currentState];
  return validTargets.includes(targetState);
}

/** Arbitrary for generating any SubscriptionStatus */
const subscriptionStatusArb = fc.constantFrom(...ALL_STATUSES);

describe('Subscription State Machine Consistency (Property 5)', () => {
  it('valid transitions: for any (currentState, targetState) pair listed in VALID_SUBSCRIPTION_TRANSITIONS, the transition is allowed', () => {
    // Generate pairs from the valid transitions map
    const validTransitionPairArb = fc.constantFrom(
      ...ALL_STATUSES.flatMap((current) =>
        VALID_SUBSCRIPTION_TRANSITIONS[current].map((target) => ({
          current,
          target,
        })),
      ),
    );

    fc.assert(
      fc.property(validTransitionPairArb, ({ current, target }) => {
        expect(isValidTransition(current, target)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('invalid transitions: for any (currentState, targetState) pair NOT in VALID_SUBSCRIPTION_TRANSITIONS, the transition is rejected', () => {
    fc.assert(
      fc.property(
        subscriptionStatusArb,
        subscriptionStatusArb,
        (currentState, targetState) => {
          const validTargets = VALID_SUBSCRIPTION_TRANSITIONS[currentState];
          if (!validTargets.includes(targetState)) {
            // This pair is NOT in the valid transitions, so it should be rejected
            expect(isValidTransition(currentState, targetState)).toBe(false);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('TRIAL can only go to ACTIVE or CANCELLED', () => {
    fc.assert(
      fc.property(subscriptionStatusArb, (targetState) => {
        const allowed = isValidTransition(SubscriptionStatus.TRIAL, targetState);
        const expectedAllowed =
          targetState === SubscriptionStatus.ACTIVE ||
          targetState === SubscriptionStatus.CANCELLED;
        expect(allowed).toBe(expectedAllowed);
      }),
      { numRuns: 100 },
    );
  });

  it('ACTIVE can only go to PAST_DUE or CANCELLED', () => {
    fc.assert(
      fc.property(subscriptionStatusArb, (targetState) => {
        const allowed = isValidTransition(SubscriptionStatus.ACTIVE, targetState);
        const expectedAllowed =
          targetState === SubscriptionStatus.PAST_DUE ||
          targetState === SubscriptionStatus.CANCELLED;
        expect(allowed).toBe(expectedAllowed);
      }),
      { numRuns: 100 },
    );
  });

  it('PAST_DUE can only go to GRACE_PERIOD or CANCELLED', () => {
    fc.assert(
      fc.property(subscriptionStatusArb, (targetState) => {
        const allowed = isValidTransition(SubscriptionStatus.PAST_DUE, targetState);
        const expectedAllowed =
          targetState === SubscriptionStatus.GRACE_PERIOD ||
          targetState === SubscriptionStatus.CANCELLED;
        expect(allowed).toBe(expectedAllowed);
      }),
      { numRuns: 100 },
    );
  });

  it('GRACE_PERIOD can go to BLOCKED, ACTIVE, or CANCELLED', () => {
    fc.assert(
      fc.property(subscriptionStatusArb, (targetState) => {
        const allowed = isValidTransition(
          SubscriptionStatus.GRACE_PERIOD,
          targetState,
        );
        const expectedAllowed =
          targetState === SubscriptionStatus.BLOCKED ||
          targetState === SubscriptionStatus.ACTIVE ||
          targetState === SubscriptionStatus.CANCELLED;
        expect(allowed).toBe(expectedAllowed);
      }),
      { numRuns: 100 },
    );
  });

  it('BLOCKED can only go to CANCELLED', () => {
    fc.assert(
      fc.property(subscriptionStatusArb, (targetState) => {
        const allowed = isValidTransition(SubscriptionStatus.BLOCKED, targetState);
        const expectedAllowed = targetState === SubscriptionStatus.CANCELLED;
        expect(allowed).toBe(expectedAllowed);
      }),
      { numRuns: 100 },
    );
  });

  it('CANCELLED has no valid outgoing transitions', () => {
    fc.assert(
      fc.property(subscriptionStatusArb, (targetState) => {
        const allowed = isValidTransition(SubscriptionStatus.CANCELLED, targetState);
        expect(allowed).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('random sequences of transitions only follow valid paths', () => {
    // Generate a random sequence of subscription states and verify each consecutive
    // transition is valid (simulating a state machine walk)
    const transitionSequenceArb = fc.array(subscriptionStatusArb, {
      minLength: 2,
      maxLength: 20,
    });

    fc.assert(
      fc.property(transitionSequenceArb, (sequence) => {
        for (let i = 0; i < sequence.length - 1; i++) {
          const current = sequence[i];
          const next = sequence[i + 1];
          const valid = isValidTransition(current, next);
          const validTargets = VALID_SUBSCRIPTION_TRANSITIONS[current];

          // The transition is valid if and only if next is in validTargets
          expect(valid).toBe(validTargets.includes(next));
        }
      }),
      { numRuns: 300 },
    );
  });
});
