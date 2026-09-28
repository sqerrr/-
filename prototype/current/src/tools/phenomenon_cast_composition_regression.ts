import { PhenomenonCastComposition } from '../core/phenomenonCastComposition.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('phenomenon-cast-composition-regression: ' + message);
}

const composition = new PhenomenonCastComposition({} as any) as any;
const calls: string[] = [];

composition.stateless = {
  cast: () => {
    calls.push('stateless');
    return true;
  }
};
composition.stateful = {
  cast: () => {
    calls.push('stateful');
    return true;
  }
};

assert(
  composition.cast('cleaver' as any, {} as any, 0, {} as any),
  'handled stateless cast no longer returns success'
);
assert(calls.join('|') === 'stateless',
  'stateful family ran after stateless family already handled the cast');

calls.length = 0;
composition.stateless = {
  cast: () => {
    calls.push('stateless');
    return false;
  }
};
composition.stateful = {
  cast: () => {
    calls.push('stateful');
    return true;
  }
};

assert(
  composition.cast('cleaver' as any, {} as any, 0, {} as any),
  'stateful fallback no longer returns its handled result'
);
assert(calls.join('|') === 'stateless|stateful',
  'cast family dispatch order changed');

console.log('phenomenon-cast-composition-regression OK', {
  order: calls.join(' -> ')
});
