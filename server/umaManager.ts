import { performance } from 'node:perf_hooks';
import { DEFAULT_UMA_CONFIG, type UmaConfig } from './umaConfig';

type ServiceType = 'piped' | 'invidious' | 'hyperpipe' | 'proxy' | 'hls';

interface InstanceState {
  url: string;
  latency: number;
  failureCount: number;
  lastFailure: number;
  lastSuccess: number;
}

interface CacheEntry<T> {
  expiresAt: number;
  payload: T;
}

interface FetchOptions extends RequestInit {
  /** Treat non-2xx responses as failures (default: true) */
  strictStatus?: boolean;
}

interface CacheOptions {
  cacheKey: string;
  ttlMs: number;
}

const FALLBACK_TIMEOUT_MS = 12_000;
const MAX_FAILURE_STREAK = 3;

export class UmaManager {
  private config: UmaConfig;
  private states = new Map<ServiceType, InstanceState[]>();
  private cache = new Map<string, CacheEntry<unknown>>();
  private lastUsedInstance = new Map<ServiceType, string>();

  constructor(config: UmaConfig) {
    this.config = config;
    this.resetStates();
  }

  public updateConfig(config: Partial<UmaConfig>) {
    this.config = { ...this.config, ...config };
    this.resetStates();
  }

  public getConfig(): UmaConfig {
    return this.config;
  }

  private resetStates() {
    const registers: Array<[ServiceType, string[]]> = [
      ['piped', this.config.piped ?? []],
      ['invidious', this.config.invidious ?? []],
      ['hyperpipe', this.config.hyperpipe ?? []],
      ['proxy', this.config.proxy ?? []],
      ['hls', this.config.hls ?? []],
    ];

    registers.forEach(([type, urls]) => {
      const existing = this.states.get(type);
      if (!existing) {
        this.states.set(
          type,
          urls.map((url) => this.createState(url)),
        );
        return;
      }

      const normalized = urls.map((url) => url.replace(/\/+$/, ''));
      const updated: InstanceState[] = normalized.map((url) => {
        const match = existing.find((state) => state.url === url);
        return match ? match : this.createState(url);
      });
      this.states.set(type, updated);
    });
  }

  private createState(url: string): InstanceState {
    const normalized = url.replace(/\/+$/, '');
    return {
      url: normalized,
      latency: Number.POSITIVE_INFINITY,
      failureCount: 0,
      lastFailure: 0,
      lastSuccess: 0,
    };
  }

  private getRankedInstances(type: ServiceType): InstanceState[] {
    const candidates = this.states.get(type) ?? [];
    return [...candidates].sort((a, b) => {
      if (a.failureCount !== b.failureCount) {
        return a.failureCount - b.failureCount;
      }
      if (a.latency !== b.latency) {
        return a.latency - b.latency;
      }
      return b.lastSuccess - a.lastSuccess;
    });
  }

  private recordSuccess(type: ServiceType, url: string, latency: number) {
    const state = this.states.get(type)?.find((item) => item.url === url);
    if (!state) return;

    state.latency = Number.isFinite(latency) ? latency : state.latency;
    state.failureCount = 0;
    state.lastSuccess = Date.now();
    this.lastUsedInstance.set(type, url);
  }

  private recordFailure(type: ServiceType, url: string) {
    const state = this.states.get(type)?.find((item) => item.url === url);
    if (!state) return;

    state.failureCount = Math.min(MAX_FAILURE_STREAK, state.failureCount + 1);
    state.lastFailure = Date.now();
    if (state.failureCount >= MAX_FAILURE_STREAK) {
      // demote latency on repeated failures to avoid being picked frequently
      state.latency = Number.POSITIVE_INFINITY;
    }
  }

  private async performRequest(
    type: ServiceType,
    candidate: InstanceState,
    buildUrl: (baseUrl: string) => string,
    fetchInit: RequestInit,
    signal: AbortSignal | undefined,
    strict: boolean,
  ): Promise<{ response: Response; latency: number }> {
    const targetUrl = buildUrl(candidate.url);
    const started = performance.now();

    const headersInit = new Headers(fetchInit.headers as HeadersInit | undefined);
    if (!headersInit.has('accept')) {
      headersInit.set('accept', 'application/json');
    }

    const response = await fetch(targetUrl, {
      ...fetchInit,
      headers: headersInit,
      signal,
    });

    const latency = performance.now() - started;

    if (strict && !response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { response, latency };
  }

  private formatErrors(type: ServiceType, errors: Array<{ url: string; error: unknown }>) {
    return new Error(
      `UmaManager: all instances failed for ${type}: ${errors
        .map((entry) => `${entry.url} -> ${(entry.error as Error)?.message ?? 'unknown error'}`)
        .join('; ')}`,
    );
  }

  public getLastSuccessfulInstance(type: ServiceType): string | undefined {
    return this.lastUsedInstance.get(type);
  }

  private makeCacheKey(type: ServiceType, key: string) {
    return `${type}::${key}`;
  }

  private getCached<T>(type: ServiceType, cacheKey?: string): T | undefined {
    if (!cacheKey) return undefined;
    const key = this.makeCacheKey(type, cacheKey);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.payload;
  }

  private setCached<T>(type: ServiceType, cacheKey: string, ttlMs: number, payload: T) {
    const key = this.makeCacheKey(type, cacheKey);
    this.cache.set(key, { payload, expiresAt: Date.now() + ttlMs });
  }

  public async fetch(
    type: ServiceType,
    buildUrl: (baseUrl: string) => string,
    options: FetchOptions = {},
  ): Promise<Response> {
    const { strictStatus = true, signal, ...fetchInit } = options;
    const strict = strictStatus;
    const candidates = this.getRankedInstances(type);

    if (!candidates.length) {
      throw new Error(`UmaManager: no instances configured for ${type}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);

    const errors: Array<{ url: string; error: unknown }> = [];
    try {
      for (const candidate of candidates) {
        try {
          const { response, latency } = await this.performRequest(
            type,
            candidate,
            buildUrl,
            fetchInit,
            signal ?? controller.signal,
            strict,
          );
          this.recordSuccess(type, candidate.url, latency);
          return response;
        } catch (error) {
          this.recordFailure(type, candidate.url);
          errors.push({ url: candidate.url, error });
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    throw this.formatErrors(type, errors);
  }

  public async fetchJson<T>(
    type: ServiceType,
    buildUrl: (baseUrl: string) => string,
    options: FetchOptions = {},
    cacheOptions?: CacheOptions,
  ): Promise<T> {
    if (cacheOptions) {
      const cached = this.getCached<T>(type, cacheOptions.cacheKey);
      if (cached) return cached;
    }

    const { strictStatus = true, signal, ...fetchInit } = options;
    const strict = strictStatus;
    const candidates = this.getRankedInstances(type);

    if (!candidates.length) {
      throw new Error(`UmaManager: no instances configured for ${type}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);
    const errors: Array<{ url: string; error: unknown }> = [];

    try {
      for (const candidate of candidates) {
        try {
          const { response, latency } = await this.performRequest(
            type,
            candidate,
            buildUrl,
            fetchInit,
            signal ?? controller.signal,
            strict,
          );

          const contentType = response.headers.get('content-type') ?? '';
          if (!contentType.toLowerCase().includes('json')) {
            throw new Error(`Unexpected content-type "${contentType || 'unknown'}"`);
          }

          const data = (await response.json()) as T;
          this.recordSuccess(type, candidate.url, latency);

          if (cacheOptions) {
            this.setCached(type, cacheOptions.cacheKey, cacheOptions.ttlMs, data);
          }

          return data;
        } catch (error) {
          this.recordFailure(type, candidate.url);
          errors.push({ url: candidate.url, error });
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    throw this.formatErrors(type, errors);
  }
}

export const uma = new UmaManager(DEFAULT_UMA_CONFIG);

