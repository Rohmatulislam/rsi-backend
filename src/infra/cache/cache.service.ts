import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
}

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);
    private readonly cache = new Map<string, CacheEntry>();
    private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

    /**
     * Set data into cache
     * @param key Unique key for the cache
     * @param data Data to store
     * @param ttl Time to live in milliseconds (optional, defaults to 5 mins)
     */
    set(key: string, data: any, ttl?: number): void {
        const entry: CacheEntry = {
            data,
            timestamp: Date.now(),
            ttl: ttl ?? this.DEFAULT_TTL,
        };
        this.cache.set(key, entry);
        this.logger.debug(`Cached data for key: ${key} (TTL: ${entry.ttl}ms)`);
    }

    /**
     * Get data from cache if it exists and is still valid
     * @param key Cache key
     * @returns Data if valid, null otherwise
     */
    get<T = any>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.logger.debug(`Cache expired for key: ${key}`);
            this.cache.delete(key);
            return null;
        }

        this.logger.debug(`Cache hit for key: ${key}`);
        return entry.data as T;
    }

    /**
     * Delete a specific cache key
     * @param key 
     */
    delete(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
        this.logger.log('Cache cleared');
    }

    /**
     * Get total number of entries in cache
     */
    get size(): number {
        return this.cache.size;
    }
}
