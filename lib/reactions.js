// The emoji people can react with. The first one is the "like" and gets its own
// always-visible button; the rest are in the reaction picker.
// Edit this list to change the options; the website picks it up automatically.
export const REACTIONS = ["❤️", "👍", "😂", "🔥", "🚀", "😮"];

export const isReaction = (emoji) => REACTIONS.includes(emoji);
