/* ─── Static dashboard content ─── */

export type InboxMessage = {
  unread: boolean;
  type: string;
  title: string;
  preview: string;
  tag: string;
  tagBg: string;
  date: string;
};

export const INBOX_MESSAGES: InboxMessage[] = [
  { unread: true, type: "Reminder", title: "Pool Party This Weekend!", preview: "Join us this Saturday for a splashin' good time at the community pool. The fun begins", tag: "Open", tagBg: "#d9ebfa", date: "July 6" },
  { unread: true, type: "Alert", title: "Landscaping Schedule", preview: "The landscaping crew will be on site next Tuesday for regular maintenance. Please keep all pets indoors", tag: "Scheduled", tagBg: "transparent", date: "July 9" },
  { unread: true, type: "Heads Up", title: "Package Delivery Changes", preview: "Effective immediately, all packages will be delivered to the front office. Please pick them up within 48 hours", tag: "Updated", tagBg: "transparent", date: "July 8" },
  { unread: false, type: "Reminder", title: "Board Meeting Next Week", preview: "The next board meeting is scheduled for next Wednesday at 7 PM in the clubhouse. All residents are welcome", tag: "Scheduled", tagBg: "#d9ebfa", date: "July 7" },
];

// The sidebar's Inbox badge counts the widget's unread messages.
export const unreadInboxCount = INBOX_MESSAGES.filter((msg) => msg.unread).length;

export const RECENT_TRANSACTIONS = [
  { date: "Sep 5, 2026", desc: "Monthly HOA Fee", amount: "$425.00" },
  { date: "Aug 5, 2026", desc: "Monthly HOA Fee", amount: "$425.00" },
  { date: "Jul 5, 2026", desc: "Monthly HOA Fee", amount: "$425.00" },
];

export const CURRENT_BALANCE = "$425.00";

export type FeedPost = {
  id: number;
  title: string;
  body: string;
  image: string;
  imageAlt: string;
  /** CSS object-position for the cropped image, e.g. "top" to keep a poster's title in view. */
  imagePosition?: string;
  links: { label: string; href: string }[];
};

export const FEED_POSTS: FeedPost[] = [
  {
    id: 1,
    title: "Food Truck Friday is back",
    body: "Join your neighbors by the clubhouse this Friday from 5–8 PM. Local favorites will be serving dinner, with lawn games and live acoustic music for the whole family.",
    image: "/assets/community-cafe.png",
    imageAlt: "Neighbors enjoying food and conversation at an outdoor cafe",
    links: [
      { label: "waterfrontcommunity.org/events", href: "https://waterfrontcommunity.org/events" },
      { label: "foodtruckfriday.com", href: "https://foodtruckfriday.com" },
    ],
  },
  {
    id: 6,
    title: "Discounted tickets: Forgotten Island (opening weekend)",
    body: "Resident perk from PerkSpot — grab discounted tickets to DreamWorks' Forgotten Island opening weekend. Save up to 35% at participating AMC, Regal, and Cinemark locations. Promo code and showtimes are available in the Offers section of the portal.",
    image: "/assets/forgotten-island.webp",
    imageAlt: "DreamWorks Forgotten Island movie poster",
    imagePosition: "top",
    links: [
      { label: "portal.waterfrontcommunity.org/offers", href: "https://portal.waterfrontcommunity.org/offers" },
      { label: "perkspot.com/forgotten-island", href: "https://perkspot.com/forgotten-island" },
    ],
  },
];
