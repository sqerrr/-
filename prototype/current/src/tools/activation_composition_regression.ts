import { ActivationComposition } from '../core/activationComposition.js';
import { ActivationRuntime } from '../core/activationRuntime.js';
import { ChoreographyTraceSystem } from '../core/choreographyTraceSystem.js';
import { PhysicalLifecycle } from '../core/physicalLifecycle.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('activation-composition-regression: ' + message);
}

const composition = new ActivationComposition(
  {} as any,
  new ActivationRuntime(),
  new ChoreographyTraceSystem(),
  new PhysicalLifecycle()
) as any;

assert(composition.legacy, 'legacy compatibility owner was not composed');
assert(composition.physicalActivations, 'physical activation owner was not composed');

const calls: string[] = [];
composition.pipeline = {
  activate: (slot: number) => {
    calls.push('activate:' + slot);
    return true;
  },
  castPayload: (_binding: unknown, x: number, z: number) => {
    calls.push('payload:' + x + ':' + z);
    return true;
  }
};
composition.physicalCatalysts = {
  handle: (_binding: unknown, event: { kind: string }) => {
    calls.push('physical:' + event.kind);
  }
};

assert(composition.activate(2), 'activate facade did not return pipeline result');
assert(
  composition.castPayload({} as any, 3, 4),
  'castPayload facade did not return pipeline result'
);
composition.handlePhysical({} as any, { kind: 'terminal' } as any);

assert(
  calls.join('|') === 'activate:2|payload:3:4|physical:terminal',
  'activation composition facade routing changed: ' + calls.join('|')
);

console.log('activation-composition-regression OK', {
  calls
});
