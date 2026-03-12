'use server';

import * as path from 'path';
import { CodebaseIngester } from '@damac/core';
import type { CodebaseSummary, FileTreeNode } from '@damac/shared';
import { getStorage } from '@/lib/storage';

const SNAPSHOT_CACHE_VERSION = 'v1';

function getExtractedDir(snapshotStoragePath: string): string {
  return path.join(getStorage().getBasePath(), snapshotStoragePath, 'extracted');
}

function getCacheKey(snapshotStoragePath: string, fileName: string): string {
  return `${snapshotStoragePath}/.cache/${SNAPSHOT_CACHE_VERSION}/${fileName}`;
}

async function readCachedJson<T>(cacheKey: string): Promise<T | null> {
  const storage = getStorage();
  if (!(await storage.exists(cacheKey))) return null;
  return JSON.parse((await storage.read(cacheKey)).toString('utf8')) as T;
}

async function writeCachedJson(cacheKey: string, value: unknown) {
  await getStorage().save(cacheKey, Buffer.from(JSON.stringify(value), 'utf8'));
}

async function readCachedText(cacheKey: string): Promise<string | null> {
  const storage = getStorage();
  if (!(await storage.exists(cacheKey))) return null;
  return (await storage.read(cacheKey)).toString('utf8');
}

async function writeCachedText(cacheKey: string, value: string) {
  await getStorage().save(cacheKey, Buffer.from(value, 'utf8'));
}

export async function getSnapshotSummary(snapshotStoragePath: string): Promise<CodebaseSummary> {
  const summaryCacheKey = getCacheKey(snapshotStoragePath, 'summary.json');
  const cachedSummary = await readCachedJson<CodebaseSummary>(summaryCacheKey);
  if (cachedSummary) return cachedSummary;

  const summary = CodebaseIngester.buildSummaryPack(getExtractedDir(snapshotStoragePath));
  await Promise.all([
    writeCachedJson(summaryCacheKey, summary),
    writeCachedJson(getCacheKey(snapshotStoragePath, 'tree.json'), summary.fileTree),
    writeCachedText(
      getCacheKey(snapshotStoragePath, 'summary-prompt.txt'),
      CodebaseIngester.summaryToPromptText(summary),
    ),
  ]);

  return summary;
}

export async function getSnapshotTree(snapshotStoragePath: string): Promise<FileTreeNode[]> {
  const treeCacheKey = getCacheKey(snapshotStoragePath, 'tree.json');
  const cachedTree = await readCachedJson<FileTreeNode[]>(treeCacheKey);
  if (cachedTree) return cachedTree;

  const cachedSummary = await readCachedJson<CodebaseSummary>(getCacheKey(snapshotStoragePath, 'summary.json'));
  if (cachedSummary) {
    await writeCachedJson(treeCacheKey, cachedSummary.fileTree);
    return cachedSummary.fileTree;
  }

  return (await getSnapshotSummary(snapshotStoragePath)).fileTree;
}

export async function getSnapshotSummaryPromptText(snapshotStoragePath: string): Promise<string> {
  const promptCacheKey = getCacheKey(snapshotStoragePath, 'summary-prompt.txt');
  const cachedPrompt = await readCachedText(promptCacheKey);
  if (cachedPrompt) return cachedPrompt;

  const summary = await getSnapshotSummary(snapshotStoragePath);
  const prompt = CodebaseIngester.summaryToPromptText(summary);
  await writeCachedText(promptCacheKey, prompt);
  return prompt;
}

export async function primeSnapshotCache(snapshotStoragePath: string) {
  await getSnapshotSummary(snapshotStoragePath);
}
