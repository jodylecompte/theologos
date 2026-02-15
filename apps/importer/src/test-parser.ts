import { parseWebBook } from './utils/web-parser';

const testData = [
  { type: "paragraph start" },
  { type: "paragraph text", chapterNumber: 1, verseNumber: 1, sectionNumber: 1, value: "First verse" },
  { type: "paragraph text", chapterNumber: 1, verseNumber: 2, sectionNumber: 1, value: "Second verse" },
  { type: "paragraph end" },
  { type: "paragraph start" },
  { type: "paragraph text", chapterNumber: 1, verseNumber: 3, sectionNumber: 1, value: "Third verse" },
];

const result = parseWebBook(testData);
console.log(JSON.stringify(result, null, 2));
