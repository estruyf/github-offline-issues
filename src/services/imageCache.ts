import { fetch } from "@tauri-apps/plugin-http";
import {
  BaseDirectory,
  writeFile,
  readFile,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";
import {
  addCachedImage,
  getCachedImageByUrl,
  getCachedImages,
} from "./storage";
import type { CachedImage } from "../types";

// Regex to find image URLs in markdown
// Matches: ![alt](url) or <img ... src="url" ... />
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
const HTML_IMAGE_REGEX = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

// Extract image URLs from markdown content
export function extractImageUrls(markdown: string): string[] {
  const urls: string[] = [];

  // Find markdown images: ![alt](url)
  let match;
  while ((match = MARKDOWN_IMAGE_REGEX.exec(markdown)) !== null) {
    const url = match[2];
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      urls.push(url);
    }
  }
  MARKDOWN_IMAGE_REGEX.lastIndex = 0;

  // Find HTML images: <img src="url" />
  while ((match = HTML_IMAGE_REGEX.exec(markdown)) !== null) {
    const url = match[1];
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      urls.push(url);
    }
  }
  HTML_IMAGE_REGEX.lastIndex = 0;

  return [...new Set(urls)]; // Return unique URLs
}

// Generate a safe filename from a URL
function urlToFilename(url: string): string {
  // Create a hash-like filename from the URL
  const hash = url.split("").reduce((acc, char) => {
    const charCode = char.charCodeAt(0);
    return ((acc << 5) - acc + charCode) | 0;
  }, 0);

  // Get the file extension from the URL or default to .png
  const urlPath = new URL(url).pathname;
  const ext = urlPath.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)?.[0] || ".png";

  return `img_${Math.abs(hash).toString(16)}${ext}`;
}

// Download and cache an image
export async function cacheImage(
  url: string,
  repoId: string
): Promise<CachedImage | null> {
  try {
    // Check if already cached
    const existing = await getCachedImageByUrl(url);
    if (existing) {
      return existing;
    }

    // Fetch the image
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "GitHub-Offline-Issues-Tauri-App",
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch image: ${url}`);
      return null;
    }

    // Get the image data as bytes
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Create the cache directory if it doesn't exist
    const cacheDir = "image-cache";
    const dirExists = await exists(cacheDir, {
      baseDir: BaseDirectory.AppData,
    });
    if (!dirExists) {
      await mkdir(cacheDir, {
        baseDir: BaseDirectory.AppData,
        recursive: true,
      });
    }

    // Generate filename and save
    const filename = urlToFilename(url);
    const localPath = `${cacheDir}/${filename}`;

    await writeFile(localPath, data, { baseDir: BaseDirectory.AppData });

    // Store the mapping
    const cachedImage: CachedImage = {
      url,
      localPath,
      repoId,
      cached_at: new Date().toISOString(),
    };

    await addCachedImage(cachedImage);

    return cachedImage;
  } catch (error) {
    console.error(`Error caching image ${url}:`, error);
    return null;
  }
}

// Cache all images in a markdown string
export async function cacheImagesInMarkdown(
  markdown: string,
  repoId: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const urls = extractImageUrls(markdown);

  for (let i = 0; i < urls.length; i++) {
    if (onProgress) {
      onProgress(i + 1, urls.length);
    }
    await cacheImage(urls[i], repoId);
  }
}

// Get the local path for a cached image URL
export async function getLocalImagePath(url: string): Promise<string | null> {
  const cached = await getCachedImageByUrl(url);
  if (!cached) {
    return null;
  }

  // Return the full path
  const appData = await appDataDir();
  return `${appData}${cached.localPath}`;
}

// Read a cached image as a data URL
export async function getCachedImageAsDataUrl(
  url: string
): Promise<string | null> {
  const cached = await getCachedImageByUrl(url);
  if (!cached) {
    return null;
  }

  try {
    const data = await readFile(cached.localPath, {
      baseDir: BaseDirectory.AppData,
    });

    // Determine MIME type from extension
    const ext =
      cached.localPath
        .match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)?.[1]
        ?.toLowerCase() || "png";
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const mimeType = mimeTypes[ext] || "image/png";

    // Convert to base64
    const base64 = btoa(String.fromCharCode(...data));

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error reading cached image ${url}:`, error);
    return null;
  }
}

// Create a map of original URLs to cached data URLs
export async function getImageUrlMap(): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const cachedImages = await getCachedImages();

  for (const cached of cachedImages) {
    const dataUrl = await getCachedImageAsDataUrl(cached.url);
    if (dataUrl) {
      urlMap.set(cached.url, dataUrl);
    }
  }

  return urlMap;
}
