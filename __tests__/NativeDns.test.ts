import {classifyNativeDnsFailure} from '../src/native/NativeDns';

test.each([
  ['INVALID_INPUT', 'invalid_input'],
  ['TIMEOUT', 'timeout'],
  ['CANCELLED', 'cancelled'],
  ['NETWORK_UNAVAILABLE', 'network_unavailable'],
  ['INVALID_RESPONSE', 'invalid_response'],
  ['INTERNAL_NATIVE', 'internal_native'],
] as const)('preserves native %s failure classification', (nativeCode, appCode) => {
  const failure = classifyNativeDnsFailure(
    new Error(`DIGGER_DNS_${nativeCode}: Classified failure.`),
  );

  expect(failure).toMatchObject({
    code: appCode,
    message: 'Classified failure.',
  });
});

test('classifies an unstructured native rejection as an internal failure', () => {
  expect(classifyNativeDnsFailure(new Error('Unexpected failure.'))).toMatchObject({
    code: 'internal_native',
    message: 'Unexpected failure.',
  });
});
