export const FLUENT_EMOJI_PREFIX = 'fluent:'

const CDN_BASE =
  'https://github.com/microsoft/fluentui-emoji-animated/raw/main/assets'

interface FluentEmoji {
  key: string
  folder: string
  label: string
  glyph: string
}

export interface FluentEmojiGroup {
  id: string
  label: string
  emojis: FluentEmoji[]
  defaultExpanded: boolean
}

/** Builds the CDN URL for an animated PNG given its folder name. */
export function buildFluentEmojiUrl(folder: string): string {
  const slug = folder.toLowerCase().replace(/ /g, '_')
  return `${CDN_BASE}/${encodeURIComponent(folder)}/animated/${slug}_animated.png`
}

export function isFluentEmojiToken(icon: string): boolean {
  return icon.startsWith(FLUENT_EMOJI_PREFIX)
}

export function fluentEmojiKey(icon: string): string | null {
  if (!isFluentEmojiToken(icon)) return null
  const key = icon.slice(FLUENT_EMOJI_PREFIX.length)
  return key.length > 0 ? key : null
}

export function toFluentEmojiToken(key: string): string {
  return `${FLUENT_EMOJI_PREFIX}${key}`
}

const FLUENT_EMOJI_BY_KEY = new Map<string, FluentEmoji>()

function e(folder: string, glyph: string, label?: string): FluentEmoji {
  const key = folder.toLowerCase().replace(/ /g, '_').replace(/-/g, '_')
  const entry: FluentEmoji = { key, folder, label: label ?? folder, glyph }
  FLUENT_EMOJI_BY_KEY.set(key, entry)
  return entry
}

export const FLUENT_EMOJI_GROUPS: FluentEmojiGroup[] = [
  {
    id: 'essentials',
    label: 'Essentials',
    defaultExpanded: true,
    emojis: [
      e('Money-mouth face', '🤑'),
      e('Fire', '🔥'),
      e('Rocket', '🚀'),
      e('Star', '⭐'),
      e('Glowing star', '🌟'),
      e('Party popper', '🎉'),
      e('Crystal ball', '🔮'),
      e('Bomb', '💣'),
      e('Hundred points', '💯'),
      e('High voltage', '⚡'),
      e('Beating heart', '💓'),
      e('Sparkling heart', '💖'),
    ],
  },
  {
    id: 'food_drink',
    label: 'Food & Drink',
    defaultExpanded: true,
    emojis: [
      e('Hot beverage', '☕'),
      e('Beer mug', '🍺'),
      e('Birthday cake', '🎂'),
      e('Clinking glasses', '🥂'),
      e('Cocktail glass', '🍸'),
      e('Tropical drink', '🍹'),
      e('Teacup without handle', '🍵'),
      e('Tumbler glass', '🥃'),
      e('Bottle with popping cork', '🍾'),
      e('Clinking beer mugs', '🍻'),
    ],
  },
  {
    id: 'travel',
    label: 'Travel & Transport',
    defaultExpanded: true,
    emojis: [
      e('Automobile', '🚗'),
      e('Airplane', '✈️'),
      e('Bus', '🚌'),
      e('Taxi', '🚕'),
      e('Delivery truck', '🚚'),
      e('Motorcycle', '🏍️'),
      e('Ambulance', '🚑'),
      e('Tractor', '🚜'),
      e('Locomotive', '🚂'),
      e('Sailboat', '⛵'),
      e('Helicopter', '🚁'),
    ],
  },
  {
    id: 'nature',
    label: 'Nature & Weather',
    defaultExpanded: true,
    emojis: [
      e('Butterfly', '🦋'),
      e('Rainbow', '🌈'),
      e('Sun', '☀️'),
      e('Snowflake', '❄️'),
      e('Unicorn', '🦄'),
      e('Shooting star', '🌠'),
      e('Comet', '☄️'),
      e('Cyclone', '🌀'),
      e('Tornado', '🌪️'),
      e('Water wave', '🌊'),
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    defaultExpanded: false,
    emojis: [
      e('Dog face', '🐶'),
      e('Cat face', '🐱'),
      e('Teddy bear', '🧸'),
      e('Penguin', '🐧'),
      e('Dolphin', '🐬'),
      e('Owl', '🦉'),
      e('Flamingo', '🦩'),
      e('Fox', '🦊'),
      e('Koala', '🐨'),
      e('Hedgehog', '🦔'),
      e('Octopus', '🐙'),
      e('Turtle', '🐢'),
      e('Shark', '🦈'),
      e('Eagle', '🦅'),
      e('Gorilla', '🦍'),
      e('Panda', '🐼'),
      e('Lion', '🦁'),
      e('Elephant', '🐘'),
      e('Whale', '🐋'),
    ],
  },
  {
    id: 'faces',
    label: 'Faces',
    defaultExpanded: false,
    emojis: [
      e('Thinking face', '🤔'),
      e('Nerd face', '🤓'),
      e('Smiling face with heart-eyes', '😍'),
      e('Star-struck', '🤩'),
      e('Face with tears of joy', '😂'),
      e('Woozy face', '🥴'),
      e('Melting face', '🫠'),
      e('Zany face', '🤪'),
      e('Smiling face with sunglasses', '😎'),
      e('Partying face', '🥳'),
      e('Exploding head', '🤯'),
      e('Hushed face', '😯'),
      e('Rolling on the floor laughing', '🤣'),
      e('Smiling face with halo', '😇'),
      e('Clown face', '🤡'),
      e('Ghost', '👻'),
      e('Alien', '👽'),
      e('Robot', '🤖'),
      e('Skull', '💀'),
      e('Jack-o-lantern', '🎃'),
    ],
  },
]

/**
 * Resolves a fluent emoji key to its CDN URL.
 * Returns undefined when the key is not in the catalog.
 */
export function resolveFluentEmojiUrl(key: string): string | undefined {
  const entry = FLUENT_EMOJI_BY_KEY.get(key)
  if (!entry) return undefined
  return buildFluentEmojiUrl(entry.folder)
}
