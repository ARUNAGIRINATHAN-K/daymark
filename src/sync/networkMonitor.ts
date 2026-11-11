export type NetworkStatusListener = (isOnline: boolean) => void;

export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private isOnline: boolean;
  private listeners: Set<NetworkStatusListener> = new Set();
  private isInitialized = false;
  private lastCheckedAt: number;

  private constructor() {
    this.isOnline = typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true;
    this.lastCheckedAt = Date.now();
  }

  public static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  private getEventTarget(): EventTarget | null {
    if (typeof window !== 'undefined') return window;
    if (typeof globalThis !== 'undefined' && (globalThis as any).addEventListener) {
      return globalThis as unknown as EventTarget;
    }
    return null;
  }

  /**
   * Initialize window event listeners once
   */
  public initialize(): void {
    if (this.isInitialized) return;

    const target = this.getEventTarget();
    if (target) {
      target.addEventListener('online', this.handleOnline);
      target.addEventListener('offline', this.handleOffline);
    }
    this.isInitialized = true;
  }

  /**
   * Cleanup event listeners (e.g. for testing or app teardown)
   */
  public destroy(): void {
    if (!this.isInitialized) return;

    const target = this.getEventTarget();
    if (target) {
      target.removeEventListener('online', this.handleOnline);
      target.removeEventListener('offline', this.handleOffline);
    }
    this.listeners.clear();
    this.isInitialized = false;
  }

  private handleOnline = () => {
    this.setOnlineState(true);
  };

  private handleOffline = () => {
    this.setOnlineState(false);
  };

  public setOnlineState(state: boolean) {
    if (this.isOnline !== state) {
      this.isOnline = state;
      this.lastCheckedAt = Date.now();
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.isOnline);
      } catch (err) {
        console.error('Error in NetworkStatus listener:', err);
      }
    }
  }

  /**
   * Subscribe to network online/offline state changes
   */
  public subscribe(listener: NetworkStatusListener): () => void {
    this.initialize();
    this.listeners.add(listener);

    // Call immediately with current state
    listener(this.isOnline);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current network state
   */
  public getStatus(): { isOnline: boolean; lastCheckedAt: number } {
    return {
      isOnline: this.isOnline,
      lastCheckedAt: this.lastCheckedAt,
    };
  }

  /**
   * Force manual connection check
   */
  public async checkReachability(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
      this.setOnlineState(false);
      return false;
    }

    this.lastCheckedAt = Date.now();
    const currentState = typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true;
    this.setOnlineState(currentState);
    return this.isOnline;
  }
}

export const networkMonitor = NetworkMonitor.getInstance();
