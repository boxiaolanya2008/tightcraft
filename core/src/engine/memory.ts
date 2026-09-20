/**
 * memory.ts —— 自研「指纹记忆」。
 *
 * 按内容哈希(校验和)作为 key 锁存文件内容，供后续引用时避免重复读取。
 * lattice: path -> hashCode；contentOf: hashCode -> content。
 * 内容相同时指纹一致，可据此判断文件是否已读过、是否变化。
 */

/** FNV-1a 32 位校验和，稳定、自研、无外部依赖。 */
function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export class FingerprintMemory {
  private readonly pathToFingerprint = new Map<string, string>();
  private readonly fingerprintToContent = new Map<string, string>();

  /** 锁存某路径的内容：记录路径指纹并缓存去重后的内容。返回指纹。 */
  latch(path: string, content: string): string {
    const fp = fingerprint(content);
    this.pathToFingerprint.set(path, fp);
    this.fingerprintToContent.set(fp, content);
    return fp;
  }

  /** 取某路径的指纹；未锁存返回 undefined。 */
  getFingerprint(path: string): string | undefined {
    return this.pathToFingerprint.get(path);
  }

  /** 依据指纹取回内容；指纹未知返回 undefined。 */
  getContent(path: string): string | undefined {
    const fp = this.pathToFingerprint.get(path);
    if (fp === undefined) return undefined;
    return this.fingerprintToContent.get(fp);
  }

  /** 遗忘某路径的指纹(内容缓存按需保留或一并清除)。 */
  evict(path: string): void {
    const fp = this.pathToFingerprint.get(path);
    this.pathToFingerprint.delete(path);
    if (fp !== undefined) this.fingerprintToContent.delete(fp);
  }

  /** 当前锁存条目数。 */
  size(): number {
    return this.pathToFingerprint.size;
  }
}

/** 全局单例，供引擎/CLI/TUI 共享。 */
export const memory = new FingerprintMemory();