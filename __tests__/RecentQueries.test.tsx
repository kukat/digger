import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import App from '../App';
import type {
  RecentQuery,
  RecentQueryStorage,
} from '../src/history/RecentQueries';
import type { DnsResult } from '../src/native/NativeDns';

function createStorage(initialEntries: RecentQuery[] = []) {
  let entries = initialEntries;
  return {
    load: jest.fn(async () => entries),
    save: jest.fn(async nextEntries => {
      entries = [...nextEntries];
    }),
  } satisfies RecentQueryStorage;
}

const answer: DnsResult = {
  rcode: 'NOERROR',
  flags: ['qr', 'rd', 'ra'],
  question: [{ name: 'example.com.', type: 'A', recordClass: 'IN' }],
  answer: [],
  authority: [],
  additional: [],
  transport: 'udp',
  elapsedMs: 1,
  wireBytes: 28,
};

function successfulNativeDns() {
  return { query: jest.fn(async () => answer), cancel: jest.fn() };
}

test('records only a normalized name and type when valid native execution begins, including an error', async () => {
  const storage = createStorage();
  const nativeDns = {
    query: jest.fn(async () => {
      throw new Error('The resolver did not respond.');
    }),
    cancel: jest.fn(),
  };

  render(<App nativeDns={nativeDns} recentQueryStorage={storage} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'Example.COM',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));

  expect(
    await screen.findByText('The resolver did not respond.'),
  ).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: /History, tab/ }));
  expect(await screen.findByText('example.com')).toBeOnTheScreen();

  await waitFor(() =>
    expect(storage.save).toHaveBeenCalledWith([
      { name: 'example.com.', type: 'A' },
    ]),
  );
});

test('removes the oldest Query when a new execution exceeds capacity', async () => {
  const entries: RecentQuery[] = Array.from({ length: 50 }, (_, index) => ({
    name: `old-${index}.example.`,
    type: 'A',
  }));
  const storage = createStorage(entries);
  const nativeDns = successfulNativeDns();

  render(<App nativeDns={nativeDns} recentQueryStorage={storage} />);
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'new.example',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));
  await screen.findByText('NOERROR');
  fireEvent.press(screen.getByRole('button', { name: /History, tab/ }));

  await waitFor(() => expect(storage.save).toHaveBeenCalled());
  expect(await screen.findByLabelText('Use new.example A')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Use old-49.example A')).not.toBeOnTheScreen();
  expect(
    screen.getAllByRole('button', { name: /Use .* A/ })[0],
  ).toHaveAccessibleName('Use new.example A');
  expect(storage.save).toHaveBeenLastCalledWith(
    expect.arrayContaining([{ name: 'new.example.', type: 'A' }]),
  );
});

test('deduplicates a rerun and moves it to the most recent position', async () => {
  const storage = createStorage([
    { name: 'second.example.', type: 'A' },
    { name: 'first.example.', type: 'A' },
  ]);

  render(
    <App nativeDns={successfulNativeDns()} recentQueryStorage={storage} />,
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'first.example',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));
  await screen.findByText('NOERROR');
  fireEvent.press(screen.getByRole('button', { name: /History, tab/ }));

  await waitFor(() => expect(storage.save).toHaveBeenCalled());
  expect(screen.getAllByRole('button', { name: /Use .* A/ })).toHaveLength(2);
  expect(
    screen.getAllByRole('button', { name: /Use .* A/ })[0],
  ).toHaveAccessibleName('Use first.example A');
});

test('refills only name and record type without running or replacing advanced settings', async () => {
  const storage = createStorage([{ name: 'recent.example.', type: 'AAAA' }]);
  const nativeDns = successfulNativeDns();

  render(<App nativeDns={nativeDns} recentQueryStorage={storage} />);
  fireEvent.press(screen.getByRole('button', { name: 'Advanced settings' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Custom resolver' }));
  fireEvent.changeText(
    screen.getByLabelText('Custom resolver address'),
    '192.0.2.53',
  );
  fireEvent.press(screen.getByRole('radio', { name: 'TCP only' }));
  fireEvent.press(screen.getByRole('button', { name: /History, tab/ }));
  fireEvent.press(await screen.findByLabelText('Use recent.example AAAA'));

  expect(await screen.findByDisplayValue('recent.example')).toBeOnTheScreen();
  expect(
    screen.getByRole('radio', { name: 'AAAA' }).props.accessibilityState,
  ).toMatchObject({
    checked: true,
  });
  expect(screen.getByDisplayValue('192.0.2.53')).toBeOnTheScreen();
  expect(
    screen.getByRole('radio', { name: 'TCP only' }).props.accessibilityState,
  ).toMatchObject({
    checked: true,
  });
  expect(nativeDns.query).not.toHaveBeenCalled();
});

test('deletes one Recent Query', async () => {
  const storage = createStorage([
    { name: 'keep.example.', type: 'A' },
    { name: 'remove.example.', type: 'TXT' },
  ]);

  render(
    <App nativeDns={successfulNativeDns()} recentQueryStorage={storage} />,
  );
  fireEvent.press(screen.getByRole('button', { name: /History, tab/ }));
  fireEvent.press(await screen.findByLabelText('Delete remove.example TXT'));

  await waitFor(() =>
    expect(
      screen.queryByLabelText('Use remove.example TXT'),
    ).not.toBeOnTheScreen(),
  );
  expect(screen.getByLabelText('Use keep.example A')).toBeOnTheScreen();
  expect(storage.save).toHaveBeenLastCalledWith([
    { name: 'keep.example.', type: 'A' },
  ]);
});

test('clears Recent Queries after confirmation and displays privacy and About information', async () => {
  const storage = createStorage([{ name: 'private.example.', type: 'A' }]);
  const confirmation = { confirmClearHistory: jest.fn(async () => true) };

  render(
    <App
      nativeDns={successfulNativeDns()}
      recentQueryStorage={storage}
      settingsConfirmation={confirmation}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: /Settings, tab/ }));

  expect(
    await screen.findByText(/Digger does not upload Query data/),
  ).toBeOnTheScreen();
  expect(screen.getByText('Version 1.0.0')).toBeOnTheScreen();
  expect(screen.getByText('Open-source licenses & notices')).toBeOnTheScreen();
  expect(screen.getByText(/c-ares — MIT License/)).toBeOnTheScreen();
  expect(screen.getByText(/Permission is hereby granted/)).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Clear History' }));

  await waitFor(() =>
    expect(confirmation.confirmClearHistory).toHaveBeenCalled(),
  );
  await waitFor(() => expect(storage.save).toHaveBeenLastCalledWith([]));
  fireEvent.press(screen.getByRole('button', { name: /History, tab/ }));
  expect(await screen.findByText('No Recent Queries yet.')).toBeOnTheScreen();
});

test('relaunch restores Recent Queries but never a Result', async () => {
  const storage = createStorage();
  const nativeDns = successfulNativeDns();
  const firstLaunch = render(
    <App nativeDns={nativeDns} recentQueryStorage={storage} />,
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('example.com'),
    'persisted.example',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Run Query' }));
  await screen.findByText('NOERROR');
  await waitFor(() => expect(storage.save).toHaveBeenCalled());
  firstLaunch.unmount();

  render(
    <App nativeDns={successfulNativeDns()} recentQueryStorage={storage} />,
  );
  fireEvent.press(screen.getByRole('button', { name: /History, tab/ }));

  expect(
    await screen.findByLabelText('Use persisted.example A'),
  ).toBeOnTheScreen();
  expect(screen.queryByText('NOERROR')).not.toBeOnTheScreen();
});
