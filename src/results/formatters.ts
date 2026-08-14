import type { DnsRecord, DnsResult } from '../native/NativeDns';

export type ResultTextInput = {
  name: string;
  type: string;
  result: DnsResult;
};

function serverDescription(result: DnsResult) {
  return result.server
    ? `${result.server.address}#${result.server.port}`
    : 'System resolver';
}

function section(title: string, records: DnsRecord[]) {
  const lines = [`;; ${title.toUpperCase()} SECTION:`];
  lines.push(...records.map(record => formatRecord(record)));
  return lines.join('\n');
}

function formatRecord(record: DnsRecord) {
  return `${record.name}\t${record.ttl}\tIN\t${record.type}\t${record.data}`;
}

export function formatDigResult({ name, type, result }: ResultTextInput) {
  return [
    `; <<>> Digger dig-style <<>> ${name} ${type}`,
    `;; ->>HEADER<<- opcode: QUERY, status: ${result.rcode}`,
    `;; flags: ${result.flags.join(' ') || 'none'}; QUERY: ${
      result.question.length
    }, ANSWER: ${result.answer.length}, AUTHORITY: ${
      result.authority.length
    }, ADDITIONAL: ${result.additional.length}`,
    '',
    ';; QUESTION SECTION:',
    ...result.question.map(
      question =>
        `;${question.name}\t${question.recordClass}\t${question.type}`,
    ),
    '',
    section('Answer', result.answer),
    '',
    section('Authority', result.authority),
    '',
    section('Additional', result.additional),
    '',
    `;; Query time: ${result.elapsedMs} msec`,
    `;; SERVER: ${serverDescription(
      result,
    )} (${result.transport.toUpperCase()})`,
    `;; MSG SIZE rcvd: ${result.wireBytes}`,
  ].join('\n');
}

function structuredSection(title: string, records: DnsRecord[]) {
  return [
    `${title} (${records.length})`,
    ...records.flatMap(record => [
      `${record.name} · ${record.type} · ${record.ttl}`,
      record.data,
    ]),
  ];
}

export function formatStructuredResult({
  name,
  type,
  result,
}: ResultTextInput) {
  return [
    'Digger Structured Result',
    `Query: ${name} · ${type}`,
    `Transport: ${result.transport.toUpperCase()}`,
    `Server: ${
      result.server
        ? `${result.server.address}:${result.server.port}`
        : 'System resolver'
    }`,
    `Rcode: ${result.rcode}`,
    `Time: ${result.elapsedMs} ms`,
    `Message size: ${result.wireBytes} B`,
    `Flags: ${result.flags.join(' ') || 'none'}`,
    '',
    `Question (${result.question.length})`,
    ...result.question.map(
      question =>
        `${question.name} · ${question.type} · ${question.recordClass}`,
    ),
    '',
    ...structuredSection('Answer', result.answer),
    '',
    ...structuredSection('Authority', result.authority),
    '',
    ...structuredSection('Additional', result.additional),
  ].join('\n');
}
