// The emoji people can react with. The first one ("❤️") is the like: the page
// shows it as a heart icon button of its own, and the rest go in the reaction
// picker. Edit this list to change the options (keep the like first, since
// existing likes are stored under it); the website picks it up automatically.
export const REACTIONS = ["❤️", "👍", "😂", "🔥", "🚀", "😮", "😢", "😠"];

export const isReaction = (emoji) => REACTIONS.includes(emoji);
