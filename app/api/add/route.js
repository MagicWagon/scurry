import { NextResponse } from "next/server";
import { config } from "@/src/lib/config";
import { qbAddUrl, qbLogin } from "@/src/lib/qbittorrent";
import { bustStatsCache } from "../user-stats/route.js";
import { buildFLDownloadUrl } from "@/src/lib/utilities";
import { readSettings } from "@/src/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveCategory(body, settings) {
  if (settings?.categories?.enabled === false) return "";
  if (body.category) return body.category;

  const mediaType = body.mediaType;
  if (mediaType === "books" || mediaType === "audiobooks") {
    return settings?.categories?.defaults?.[mediaType]
      || (mediaType === "books" ? config.qbBookCategory : config.qbAudiobookCategory);
  }

  return config.qbCategory;
}

export async function POST(req) {
  const body = await req.json();
  const title = body.title;
  const downloadUrl = body.downloadUrl;
  const useWedge = body.useWedge || false;
  const tags = body.tags || []; // Array of tag strings
  
  if (!downloadUrl) {
    return NextResponse.json({ ok: false, error: "No magnet or torrentUrl provided" }, { status: 400 });
  }

  // When freeleech is requested, append &fl to the download URL.
  // This forces a personal freeleech on the download server-side without
  // requiring a separate bonusBuy API call (which is not allowed via API).
  const urlOrMagnet = useWedge ? (buildFLDownloadUrl(downloadUrl) ?? downloadUrl) : downloadUrl;
  
  // Read settings once to determine qBittorrent credentials, category, and tag behavior
  let settings = null;
  try {
    settings = readSettings();
  } catch {
    settings = null;
  }

  // Derive qBittorrent connection details from settings (if available) or fall back to config
  const qbUrl = settings?.qbittorrent?.url || config.qbUrl;
  const qbUser = settings?.qbittorrent?.username || config.qbUser;
  const qbPass = settings?.qbittorrent?.password || config.qbPass;

  // Resolve the category server-side so custom per-medium defaults cannot drift
  // from the browser state. Explicit legacy category values remain supported.
  const category = resolveCategory(body, settings);

  // Determine tags: only pass if tags are enabled in settings
  let effectiveTags = [];
  if (settings?.tags?.enabled && Array.isArray(tags) && tags.length > 0) {
    effectiveTags = tags;
  }

  try {
    const cookie = await qbLogin(qbUrl, qbUser, qbPass);
    await qbAddUrl(qbUrl, cookie, urlOrMagnet, {
      category: category || undefined,
      tags: effectiveTags.length > 0 ? effectiveTags : undefined,
    });

    const tagInfo = effectiveTags.length > 0 ? ` [tags: ${effectiveTags.join(", ")}]` : "";
    const catInfo = category ? ` (${category})` : "";
    console.log(`Added to qBittorrent: ${title}${catInfo}${tagInfo}${useWedge ? ' with FL (&fl)' : ''}`);
    
    // Bust user stats cache since download affects stats
    bustStatsCache();
    
    return NextResponse.json({ ok: true, wedgeUsed: useWedge });
  } catch (err) {
    console.error(`Failed to add to qBittorrent: ${title} - ${err?.message || err}`);
    return NextResponse.json({ ok: false, error: err?.message || "Add failed" }, { status: 500 });
  }
}
