import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunner, type WorkerLike } from '../../src/services/runner';
import { checkForUpdate, isNewerVersion } from '../../src/services/updates';
import { detectLanguage, translations } from '../../src/i18n';
afterEach(() => vi.useRealTimers());
const request = { expression: 'sqrt(4)', precision: 50, mode: 'numeric' as const };
const fakeWorker = (): WorkerLike => ({
  onmessage: null,
  onerror: null,
  postMessage: vi.fn(),
  terminate: vi.fn(),
});
describe('worker isolation and recovery (white box)', () => {
  it('terminates on success and ignores late replies', async () => {
    const w = fakeWorker();
    const client = createRunner(() => w);
    const promise = client.run(request);
    const result = { mode: 'numeric' as const, value: { re: '2', im: '0' }, warnings: [] };
    w.onmessage!({ data: { ok: true, result } } as MessageEvent);
    w.onmessage!({ data: { ok: false, code: 'DOMAIN' } } as MessageEvent);
    await expect(promise).resolves.toEqual(result);
    expect(w.terminate).toHaveBeenCalledOnce();
  });
  it('stops on timeout and can start again', async () => {
    vi.useFakeTimers();
    const w = fakeWorker();
    const client = createRunner(() => w, 100);
    const outcome = expect(client.run(request)).rejects.toBe('TIMEOUT');
    await vi.advanceTimersByTimeAsync(100);
    await outcome;
    expect(w.terminate).toHaveBeenCalledOnce();
    const next = expect(client.run(request)).rejects.toBe('CANCELLED');
    client.cancel();
    await next;
  });
  it('cancels previous work when a new request starts', async () => {
    const client = createRunner(fakeWorker);
    const first = expect(client.run(request)).rejects.toBe('CANCELLED');
    const second = expect(client.run(request)).rejects.toBe('CANCELLED');
    client.cancel();
    client.cancel();
    await first;
    await second;
  });
  it('reports computation errors', async () => {
    const w = fakeWorker(),
      client = createRunner(() => w);
    const promise = client.run(request);
    w.onmessage!({ data: { ok: false, code: 'DIV_ZERO' } } as MessageEvent);
    await expect(promise).rejects.toBe('DIV_ZERO');
  });
  it('handles worker creation, transport and runtime failures', async () => {
    await expect(
      createRunner(() => {
        throw new Error();
      }).run(request),
    ).rejects.toBe('WORKER');
    const w = fakeWorker();
    w.postMessage = () => {
      throw new Error();
    };
    await expect(createRunner(() => w).run(request)).rejects.toBe('WORKER');
    const w2 = fakeWorker();
    const promise = createRunner(() => w2).run(request);
    w2.onerror!({} as ErrorEvent);
    await expect(promise).rejects.toBe('WORKER');
  });
});
describe('update protocol', () => {
  it.each([
    ['v1.0.1', true],
    ['2.0.0', true],
    ['1.1.0', true],
    ['1.0.0', false],
    ['0.9.9', false],
    ['0.0.1', false],
  ])('compares %s', (version, newer) => expect(isNewerVersion(version)).toBe(newer));
  it.each(['latest', '1.0', 'v1.2.3<script>', '1.0.1-beta', '99999.0.0'])(
    'rejects malformed version %s',
    (value) => expect(() => isNewerVersion(value)).toThrow(),
  );
  it('does not send expressions or credentials', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ tag_name: 'v1.2.3' }) });
    await expect(checkForUpdate(fetcher)).resolves.toEqual({ version: 'v1.2.3', newer: true });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/kotyasmol/radical-lab/releases/latest',
      expect.objectContaining({ credentials: 'omit', cache: 'no-store' }),
    );
  });
  it('handles unavailable/malformed update servers', async () => {
    await expect(checkForUpdate(vi.fn().mockResolvedValue({ ok: false }))).rejects.toThrow();
    for (const body of [null, {}, { tag_name: 123 }, 'v2.0.0'])
      await expect(
        checkForUpdate(vi.fn().mockResolvedValue({ ok: true, json: async () => body })),
      ).rejects.toThrow();
    await expect(checkForUpdate(vi.fn().mockRejectedValue(new Error('offline')))).rejects.toThrow();
  });
});
describe('all four locales', () => {
  it.each([
    ['ru-RU', 'ru'],
    ['en-US', 'en'],
    ['es-ES', 'es'],
    ['zh-CN', 'zh'],
    ['ZH_tw', 'zh'],
    ['de-DE', 'en'],
    ['__proto__', 'en'],
  ])('detects %s', (locale, expected) => expect(detectLanguage(locale)).toBe(expected));
  it('contains a nonempty translation of every key in every language', () => {
    const keys = Object.keys(translations.en).sort();
    for (const dictionary of Object.values(translations)) {
      expect(Object.keys(dictionary).sort()).toEqual(keys);
      for (const value of Object.values(dictionary)) expect(value.trim()).not.toBe('');
    }
  });
});
