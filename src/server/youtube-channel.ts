import "server-only";
import { MOCK_CHANNEL_INFO } from "@/server/mock/fixtures";

// Channel profile for the public /explore page (FR-PUB-4).

export type ChannelInfo = {
  title: string;
  handle: string;
  description: string;
  url: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
};

/**
 * The RepresENT channel's profile and headline stats.
 *
 * Hard-coded for now (§13 A11), in both mock and live mode. When the YouTube
 * channel API is wired up, call `channels.list` (part=snippet,statistics) for
 * the configured channel ID here, and cache the result; callers won't change.
 */
export async function getChannelInfo(): Promise<ChannelInfo> {
  return MOCK_CHANNEL_INFO;
}
