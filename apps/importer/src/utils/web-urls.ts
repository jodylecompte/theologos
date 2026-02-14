/**
 * URL mapping for World English Bible JSON files
 *
 * Maps canonical book names to their JSON filenames in the WEB repository.
 */

const WEB_BASE_URL = 'https://raw.githubusercontent.com/TehShrike/world-english-bible/refs/heads/master/json';

/**
 * Map canonical book names to WEB JSON filenames
 *
 * The WEB repository uses lowercase filenames without hyphens.
 */
export const WEB_BOOK_URLS: Record<string, string> = {
  // Old Testament
  'Genesis': `${WEB_BASE_URL}/genesis.json`,
  'Exodus': `${WEB_BASE_URL}/exodus.json`,
  'Leviticus': `${WEB_BASE_URL}/leviticus.json`,
  'Numbers': `${WEB_BASE_URL}/numbers.json`,
  'Deuteronomy': `${WEB_BASE_URL}/deuteronomy.json`,
  'Joshua': `${WEB_BASE_URL}/joshua.json`,
  'Judges': `${WEB_BASE_URL}/judges.json`,
  'Ruth': `${WEB_BASE_URL}/ruth.json`,
  '1 Samuel': `${WEB_BASE_URL}/1samuel.json`,
  '2 Samuel': `${WEB_BASE_URL}/2samuel.json`,
  '1 Kings': `${WEB_BASE_URL}/1kings.json`,
  '2 Kings': `${WEB_BASE_URL}/2kings.json`,
  '1 Chronicles': `${WEB_BASE_URL}/1chronicles.json`,
  '2 Chronicles': `${WEB_BASE_URL}/2chronicles.json`,
  'Ezra': `${WEB_BASE_URL}/ezra.json`,
  'Nehemiah': `${WEB_BASE_URL}/nehemiah.json`,
  'Esther': `${WEB_BASE_URL}/esther.json`,
  'Job': `${WEB_BASE_URL}/job.json`,
  'Psalms': `${WEB_BASE_URL}/psalms.json`,
  'Proverbs': `${WEB_BASE_URL}/proverbs.json`,
  'Ecclesiastes': `${WEB_BASE_URL}/ecclesiastes.json`,
  'Song of Solomon': `${WEB_BASE_URL}/songofsolomon.json`,
  'Isaiah': `${WEB_BASE_URL}/isaiah.json`,
  'Jeremiah': `${WEB_BASE_URL}/jeremiah.json`,
  'Lamentations': `${WEB_BASE_URL}/lamentations.json`,
  'Ezekiel': `${WEB_BASE_URL}/ezekiel.json`,
  'Daniel': `${WEB_BASE_URL}/daniel.json`,
  'Hosea': `${WEB_BASE_URL}/hosea.json`,
  'Joel': `${WEB_BASE_URL}/joel.json`,
  'Amos': `${WEB_BASE_URL}/amos.json`,
  'Obadiah': `${WEB_BASE_URL}/obadiah.json`,
  'Jonah': `${WEB_BASE_URL}/jonah.json`,
  'Micah': `${WEB_BASE_URL}/micah.json`,
  'Nahum': `${WEB_BASE_URL}/nahum.json`,
  'Habakkuk': `${WEB_BASE_URL}/habakkuk.json`,
  'Zephaniah': `${WEB_BASE_URL}/zephaniah.json`,
  'Haggai': `${WEB_BASE_URL}/haggai.json`,
  'Zechariah': `${WEB_BASE_URL}/zechariah.json`,
  'Malachi': `${WEB_BASE_URL}/malachi.json`,

  // New Testament
  'Matthew': `${WEB_BASE_URL}/matthew.json`,
  'Mark': `${WEB_BASE_URL}/mark.json`,
  'Luke': `${WEB_BASE_URL}/luke.json`,
  'John': `${WEB_BASE_URL}/john.json`,
  'Acts': `${WEB_BASE_URL}/acts.json`,
  'Romans': `${WEB_BASE_URL}/romans.json`,
  '1 Corinthians': `${WEB_BASE_URL}/1corinthians.json`,
  '2 Corinthians': `${WEB_BASE_URL}/2corinthians.json`,
  'Galatians': `${WEB_BASE_URL}/galatians.json`,
  'Ephesians': `${WEB_BASE_URL}/ephesians.json`,
  'Philippians': `${WEB_BASE_URL}/philippians.json`,
  'Colossians': `${WEB_BASE_URL}/colossians.json`,
  '1 Thessalonians': `${WEB_BASE_URL}/1thessalonians.json`,
  '2 Thessalonians': `${WEB_BASE_URL}/2thessalonians.json`,
  '1 Timothy': `${WEB_BASE_URL}/1timothy.json`,
  '2 Timothy': `${WEB_BASE_URL}/2timothy.json`,
  'Titus': `${WEB_BASE_URL}/titus.json`,
  'Philemon': `${WEB_BASE_URL}/philemon.json`,
  'Hebrews': `${WEB_BASE_URL}/hebrews.json`,
  'James': `${WEB_BASE_URL}/james.json`,
  '1 Peter': `${WEB_BASE_URL}/1peter.json`,
  '2 Peter': `${WEB_BASE_URL}/2peter.json`,
  '1 John': `${WEB_BASE_URL}/1john.json`,
  '2 John': `${WEB_BASE_URL}/2john.json`,
  '3 John': `${WEB_BASE_URL}/3john.json`,
  'Jude': `${WEB_BASE_URL}/jude.json`,
  'Revelation': `${WEB_BASE_URL}/revelation.json`,
};

/**
 * Get WEB JSON URL for a canonical book name
 */
export function getWebBookUrl(canonicalName: string): string | undefined {
  return WEB_BOOK_URLS[canonicalName];
}
