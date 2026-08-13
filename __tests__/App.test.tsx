import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';

import App from '../App';
import type {DnsResult} from '../src/native/NativeDns';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {promise, resolve, reject};
}

const answer: DnsResult = {
  rcode: 'NOERROR',
  flags: ['qr', 'rd', 'ra'],
  question: [{name: 'example.com.', type: 'A', recordClass: 'IN'}],
  answer: [
    {name: 'example.com.', type: 'A', ttl: 3600, data: '93.184.216.34'},
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

  expect(
    screen.getByRole('button', {name: /Query, tab/}),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('button', {name: /History, tab/}),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('button', {name: /Settings, tab/}),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', {name: /Result, tab/}),
  ).not.toBeOnTheScreen();

  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'example.com',
  );
  fireEvent.press(screen.getByRole('button', {name: 'Run Query'}));

  expect(screen.getByText('Looking up example.com…')).toBeOnTheScreen();

  pending.resolve(answer);

  expect(await screen.findByText('NOERROR')).toBeOnTheScreen();
  expect(screen.getByText('93.184.216.34')).toBeOnTheScreen();
  expect(screen.getByText('example.com · A')).toBeOnTheScreen();
});

test('runs an AAAA Query against a custom IPv6 resolver', async () => {
  const nativeDns = {
    query: jest.fn(async () => ({
      ...answer,
      question: [{name: 'example.com.', type: 'AAAA', recordClass: 'IN'}],
      answer: [
        {name: 'example.com.', type: 'AAAA', ttl: 60, data: '2001:db8::1'},
      ],
      server: {address: '2001:db8::53', port: 5353},
    })),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} />);
  fireEvent.changeText(screen.getByPlaceholderText('example.com'), 'example.com');
  fireEvent.press(screen.getByRole('radio', {name: 'AAAA'}));
  fireEvent.press(screen.getByRole('radio', {name: 'Custom resolver'}));
  fireEvent.changeText(
    screen.getByLabelText('Custom resolver address'),
    '2001:db8::53',
  );
  fireEvent.changeText(screen.getByLabelText('Custom resolver port'), '5353');
  fireEvent.press(screen.getByRole('button', {name: 'Run Query'}));

  expect(await screen.findByText('2001:db8::1')).toBeOnTheScreen();
  expect(nativeDns.query).toHaveBeenCalledWith(
    'query-1',
    expect.objectContaining({
      type: 'AAAA',
      resolver: {mode: 'custom', address: '2001:db8::53', port: 5353},
    }),
  );
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
  fireEvent.press(screen.getByRole('button', {name: 'Run Query'}));
  await screen.findByText('NOERROR');

  fireEvent.press(screen.getByRole('button', {name: /back/i}));

  expect(screen.queryByText('NOERROR')).not.toBeOnTheScreen();
  expect(screen.getByDisplayValue('example.com')).toBeOnTheScreen();
  expect(screen.queryByText('93.184.216.34')).not.toBeOnTheScreen();
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
  fireEvent.press(screen.getByRole('button', {name: 'Run Query'}));

  expect(
    await screen.findByText('The simulated resolver timed out.'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('alert')).toBeOnTheScreen();
  expect(screen.getByDisplayValue('slow.example')).toBeOnTheScreen();
});
