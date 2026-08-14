import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import App from '../App';
import { NativeDnsError, type DnsResult } from '../src/native/NativeDns';
import type { ResultActions } from '../src/results/actions';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

const answer: DnsResult = {
  rcode: 'NOERROR',
  flags: ['qr', 'rd', 'ra'],
  question: [{ name: 'example.com.', type: 'A', recordClass: 'IN' }],
  answer: [
    { name: 'example.com.', type: 'A', ttl: 3600, data: '93.184.216.34' },
  ],
  authority: [],
  additional: [],
  transport: 'udp' as const,
  elapsedMs: 18,
  wireBytes: 56,
};

test('runs an injected A Query and shows loading before its Result', async () => {
  const pending = deferred<typeof answer>();
  const nativeDns = {
    query: jest.fn(() => pending.promise),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);

  expect(screen.getByRole('button', { name: /Query, tab/ })).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: /History, tab/ }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: /Settings, tab/ }),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: /Result, tab/ }),
  ).not.toBeOnTheScreen();

  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'example.com',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  expect(screen.getByText('Looking up example.com…')).toBeOnTheScreen();
  expect(nativeDns.query).toHaveBeenCalledWith(
    'query-1',
    expect.objectContaining({
      name: 'example.com.',
      type: 'A',
      resolver: { mode: 'system' },
      transport: 'auto',
      ednsUdpSize: 1232,
      dnssecOk: false,
      timeoutMs: 3000,
      retries: 1,
    }),
  );

  pending.resolve(answer);

  expect(await screen.findByText('NOERROR')).toBeOnTheScreen();
  expect(screen.getByText('93.184.216.34')).toBeOnTheScreen();
  expect(screen.getByText('example.com · A')).toBeOnTheScreen();
});

test('runs an AAAA Query against a custom IPv6 resolver', async () => {
  const nativeDns = {
    query: jest.fn(async () => ({
      ...answer,
      question: [{ name: 'example.com.', type: 'AAAA', recordClass: 'IN' }],
      answer: [
        { name: 'example.com.', type: 'AAAA', ttl: 60, data: '2001:db8::1' },
      ],
      server: { address: '2001:db8::53', port: 5353 },
    })),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'example.com',
  );
  fireEvent.press(screen.getByRole('radio', { name: 'AAAA' }));
  fireEvent.press(screen.getByRole('button', { name: 'Advanced settings' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Custom resolver' }));
  fireEvent.changeText(
    screen.getByLabelText('Custom resolver address'),
    '2001:db8::53',
  );
  fireEvent.changeText(screen.getByLabelText('Custom resolver port'), '5353');
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  expect(await screen.findByText('2001:db8::1')).toBeOnTheScreen();
  expect(nativeDns.query).toHaveBeenCalledWith(
    'query-1',
    expect.objectContaining({
      type: 'AAAA',
      resolver: { mode: 'custom', address: '2001:db8::53', port: 5353 },
    }),
  );
});

test('passes configurable transport, EDNS, DO, timeout, and retries', async () => {
  const nativeDns = {
    query: jest.fn(async () => ({ ...answer, transport: 'tcp' as const })),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'example.com',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Advanced settings' }));
  fireEvent.press(screen.getByRole('radio', { name: 'TCP only' }));
  fireEvent.press(
    screen.getByRole('switch', { name: 'Request DNSSEC records' }),
  );
  fireEvent.changeText(screen.getByLabelText('EDNS UDP size'), '1400');
  fireEvent.changeText(screen.getByLabelText('Timeout in milliseconds'), '750');
  fireEvent.changeText(screen.getByLabelText('Retries'), '2');
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  expect(await screen.findByText('NOERROR')).toBeOnTheScreen();
  expect(screen.getByText(/TCP · System resolver/)).toBeOnTheScreen();
  expect(nativeDns.query).toHaveBeenCalledWith(
    'query-1',
    expect.objectContaining({
      transport: 'tcp',
      dnssecOk: true,
      ednsUdpSize: 1400,
      timeoutMs: 750,
      retries: 2,
    }),
  );
});

test('can disable EDNS without changing other advanced settings', async () => {
  const nativeDns = {
    query: jest.fn(async () => answer),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'example.com',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Advanced settings' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Start with UDP' }));
  fireEvent.press(screen.getByRole('switch', { name: 'Enable EDNS' }));
  fireEvent.changeText(screen.getByLabelText('Retries'), '3');
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  await screen.findByText('NOERROR');
  expect(nativeDns.query).toHaveBeenCalledWith(
    'query-1',
    expect.objectContaining({
      transport: 'udp',
      retries: 3,
      ednsUdpSize: undefined,
    }),
  );
});

test('locks Query fields while active and cancellation cannot affect the next Query', async () => {
  const first = deferred<DnsResult>();
  const second = deferred<DnsResult>();
  const nativeDns = {
    query: jest
      .fn<Promise<DnsResult>, []>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.press(screen.getByRole('button', { name: 'Advanced settings' }));
  const nameInput = screen.getByPlaceholderText('example.com');
  fireEvent.changeText(nameInput, 'first.example');
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  expect(nameInput).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'AAAA' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'TCP only' })).toBeDisabled();
  expect(screen.getByLabelText('EDNS UDP size')).toBeDisabled();
  expect(screen.getByLabelText('Timeout in milliseconds')).toBeDisabled();
  expect(screen.getByRole('switch', { name: 'Enable EDNS' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Cancel Query' }),
  ).toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: 'Cancel Query' }));
  expect(nativeDns.cancel).toHaveBeenCalledWith('query-1');
  expect(screen.getByText('Query cancelled')).toBeOnTheScreen();
  expect(nameInput).toBeEnabled();

  fireEvent.changeText(nameInput, 'second.example');
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));
  await act(async () => first.resolve(answer));
  expect(screen.queryByText('93.184.216.34')).not.toBeOnTheScreen();

  second.resolve({
    ...answer,
    answer: [
      { name: 'second.example.', type: 'A', ttl: 60, data: '192.0.2.2' },
    ],
  });
  expect(await screen.findByText('192.0.2.2')).toBeOnTheScreen();
});

test('shows classified native failures distinctly', async () => {
  const nativeDns = {
    query: jest.fn(async () => {
      throw new NativeDnsError(
        'timeout',
        'No response arrived before the deadline.',
      );
    }),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.changeText(screen.getByPlaceholderText('example.com'), 'slow.test');
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  expect(await screen.findByText('Query timed out')).toBeOnTheScreen();
  expect(
    screen.getByText('No response arrived before the deadline.'),
  ).toBeOnTheScreen();
});

test('returning from Result retains the Query form and discards the Result', async () => {
  const nativeDns = {
    query: jest.fn(async () => answer),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'example.com',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));
  await screen.findByText('NOERROR');

  fireEvent.press(screen.getByRole('button', { name: /back/i }));

  expect(screen.queryByText('NOERROR')).not.toBeOnTheScreen();
  expect(screen.getByDisplayValue('example.com')).toBeOnTheScreen();
  expect(screen.queryByText('93.184.216.34')).not.toBeOnTheScreen();
});

test('accepts PTR addresses, offers every record type, and rejects URLs as DNS names', async () => {
  const nativeDns = {
    query: jest.fn(async () => answer),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.press(screen.getByRole('button', { name: 'More record types' }));
  fireEvent.press(screen.getByRole('radio', { name: 'PTR' }));
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    '2001:db8::1',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  await screen.findByText('NOERROR');
  expect(nativeDns.query).toHaveBeenCalledWith(
    'query-1',
    expect.objectContaining({
      name: '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa.',
      type: 'PTR',
    }),
  );

  fireEvent.press(screen.getByRole('button', { name: /back/i }));
  fireEvent.press(screen.getByRole('radio', { name: 'A' }));
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'https://example.com',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));
  expect(
    screen.getByText('Enter a valid DNS name, not a URL.'),
  ).toBeOnTheScreen();
  expect(nativeDns.query).toHaveBeenCalledTimes(1);
});

test('shows Question, Answer, Authority, and Additional sections from one Result', async () => {
  const nativeDns = {
    query: jest.fn(async () => ({
      ...answer,
      question: [{ name: 'example.com.', type: 'CAA', recordClass: 'IN' }],
      answer: [
        {
          name: 'example.com.',
          type: 'CAA',
          ttl: 3600,
          data: 'critical: 0 · tag: issue · value: letsencrypt.org',
        },
      ],
      authority: [
        {
          name: 'example.com.',
          type: 'SOA',
          ttl: 300,
          data: 'mname: ns1.example.com. · rname: hostmaster.example.com.',
        },
      ],
      additional: [
        {
          name: 'ns1.example.com.',
          type: 'TYPE65400',
          ttl: 60,
          data: 'RDATA: deadbeef',
        },
      ],
    })),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'example.com',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  expect(await screen.findByText('Question')).toBeOnTheScreen();
  expect(screen.getByText('CAA · IN')).toBeOnTheScreen();
  expect(screen.getByText('Answer')).toBeOnTheScreen();
  expect(screen.getByText('Authority')).toBeOnTheScreen();
  expect(screen.getByText('Additional')).toBeOnTheScreen();
  expect(screen.getByText('RDATA: deadbeef')).toBeOnTheScreen();
});

test('switches Result views and copies or shares the selected text without saving the Result', async () => {
  const nativeDns = {
    query: jest.fn(async () => answer),
    cancel: jest.fn(),
  };
  const resultActions: ResultActions = {
    copy: jest.fn(),
    share: jest.fn(async () => undefined),
  };

  render(<App nativeDns={nativeDns} resultActions={resultActions} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'example.com',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));
  await screen.findByText('NOERROR');

  fireEvent.press(
    screen.getByRole('button', { name: 'Copy Structured Result' }),
  );
  expect(resultActions.copy).toHaveBeenCalledWith(
    expect.stringContaining('Digger Structured Result'),
  );

  fireEvent.press(screen.getByRole('tab', { name: 'dig view' }));
  expect(screen.getByText(/Digger dig-style/)).toBeOnTheScreen();
  fireEvent.press(
    screen.getByRole('button', { name: 'Copy dig-style Result' }),
  );
  expect(resultActions.copy).toHaveBeenLastCalledWith(
    expect.stringContaining(';; MSG SIZE rcvd: 56'),
  );

  await act(async () => {
    fireEvent.press(
      screen.getByRole('button', { name: 'Share dig-style Result' }),
    );
  });
  expect(resultActions.share).toHaveBeenCalledWith(
    expect.stringContaining(';; ->>HEADER<<- opcode: QUERY, status: NOERROR'),
  );
});

test('exposes the compact Query controls with accessible guidance and state', () => {
  const nativeDns = {
    query: jest.fn(async () => answer),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);

  expect(screen.getByLabelText('DNS name')).toHaveProp(
    'accessibilityHint',
    'Enter the DNS name to look up.',
  );
  expect(
    screen.getByRole('radio', { name: 'A' }).props.accessibilityState,
  ).toMatchObject({ checked: true });
  expect(
    screen.getByRole('button', { name: 'More record types' }).props
      .accessibilityState,
  ).toMatchObject({ expanded: false });
  expect(screen.getByRole('button', { name: 'Advanced settings' })).toHaveProp(
    'accessibilityHint',
    'Shows resolver, transport, EDNS, DNSSEC, timeout, and retry settings.',
  );
  expect(screen.getByRole('button', { name: 'Run Query' })).toHaveProp(
    'accessibilityHint',
    'Runs the selected DNS Query.',
  );
});

test('shows an injected native error without network access', async () => {
  const nativeDns = {
    query: jest.fn(async () => {
      throw new Error('The simulated resolver timed out.');
    }),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'slow.example',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  expect(
    await screen.findByText('The simulated resolver timed out.'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('alert')).toBeOnTheScreen();
  expect(screen.getByDisplayValue('slow.example')).toBeOnTheScreen();
});
