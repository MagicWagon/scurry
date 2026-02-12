import { NextResponse } from "next/server";
import { config } from "@/src/lib/config";
import { qbAddUrl, qbLogin } from "@/src/lib/qbittorrent";
import { bustStatsCache } from "../user-stats/route.js";
import { purchaseFlWedge } from "@/src/lib/wedge";
import { readSettings } from "@/src/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json();
  const title = body.title;
  const urlOrMagnet = body.downloadUrl;
  const torrentId = body.torrentId;
  const useWedge = body.useWedge || false;
  const tags = body.tags || []; // Array of tag strings
  
  if (!urlOrMagnet) {
    return NextResponse.json({ ok: false, error: "No magnet or torrentUrl provided" }, { status: 400 });
  }
  
  // Read settings to determine category and tag behavior
  let settings;
  try {
    settings = readSettings();
  } catch {
    settings = null;
  }

  // Determine category: use settings if available, otherwise fall back to request/config
  let category;
  if (settings?.categories?.enabled) {
    // Use the category from the request body (client sends the right medium default)
    category = body.category || "";
  } else if (settings && !settings.categories?.enabled) {
    // Categories disabled in settings - don't assign a category
    category = "";
  } else {
    // No settings file - fall back to legacy behavior
    category = body.category || config.qbCategory;
  }

  // Determine tags: only pass if tags are enabled in settings
  let effectiveTags = [];
  if (settings?.tags?.enabled && Array.isArray(tags) && tags.length > 0) {
    effectiveTags = tags;
  }

  try {
    // If wedge is requested, purchase it first before adding torrent
    if (useWedge) {
      console.log(`Purchasing FL wedge for: ${title}`);
      
      const wedgeResult = await purchaseFlWedge(torrentId);
      
      if (!wedgeResult.success) {
        const errorMsg = wedgeResult.error || "Failed to purchase FL wedge";
        console.error(`FL wedge purchase failed for ${title}: ${errorMsg}`);
        return NextResponse.json(
          { ok: false, error: errorMsg, wedgeFailed: true, tokenExpired: wedgeResult.tokenExpired },
          { status: wedgeResult.statusCode || 500 }
        );
      }
      
      console.log(`FL wedge successfully applied for: ${title}`);
    }

    // Proceed with adding torrent to qBittorrent
    const cookie = await qbLogin(config.qbUrl, config.qbUser, config.qbPass);
    await qbAddUrl(config.qbUrl, cookie, urlOrMagnet, {
      category: category || undefined,
      tags: effectiveTags.length > 0 ? effectiveTags : undefined,
    });
    
    const tagInfo = effectiveTags.length > 0 ? ` [tags: ${effectiveTags.join(", ")}]` : "";
    const catInfo = category ? ` (${category})` : "";
    console.log(`Added to qBittorrent: ${title}${catInfo}${tagInfo}${useWedge ? ' with FL wedge' : ''}`);
    
    // Bust user stats cache since download affects stats
    bustStatsCache();
    
    return NextResponse.json({ ok: true, wedgeUsed: useWedge });
  } catch (err) {
    console.error(`Failed to add to qBittorrent: ${title} - ${err?.message || err}`);
    return NextResponse.json({ ok: false, error: err?.message || "Add failed" }, { status: 500 });
  }
}
