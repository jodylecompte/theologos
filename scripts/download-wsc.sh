#!/bin/bash

###############################################################################
# Download Westminster Shorter Catechism Source
#
# This script downloads the WSC data from the ReformedDevs GitHub repository
# and converts it to JSON format (no CoffeeScript compiler needed).
#
# Usage:
#   ./scripts/download-wsc.sh
#
# Output:
#   ./data/wsc-questions.json
###############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SOURCE_URL="https://raw.githubusercontent.com/ReformedDevs/hubot-wsc/refs/heads/master/lib/questions.coffee"
OUTPUT_DIR="./data"
TEMP_FILE="$OUTPUT_DIR/wsc-raw.coffee"
JSON_FILE="$OUTPUT_DIR/wsc-questions.json"

echo -e "${GREEN}Westminster Shorter Catechism Downloader${NC}"
echo "========================================="
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Download CoffeeScript file
echo -e "${YELLOW}→${NC} Downloading WSC data from GitHub..."
if curl -fsSL -o "$TEMP_FILE" "$SOURCE_URL"; then
  echo -e "${GREEN}✓${NC} Downloaded CoffeeScript source"
else
  echo -e "${RED}✗${NC} Failed to download WSC data"
  exit 1
fi

# Extract to JSON (no CoffeeScript compiler needed)
echo -e "${YELLOW}→${NC} Extracting JSON data..."

# Create extraction script
cat > "$OUTPUT_DIR/extract-wsc.js" << 'EXTRACT_SCRIPT'
const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'wsc-raw.coffee');
const outputFile = path.join(__dirname, 'wsc-questions.json');

const content = fs.readFileSync(inputFile, 'utf-8');

// Remove the module.exports wrapper
const arrayContent = content
  .replace(/^module\.exports\s*=\s*\(robot\)\s*->\s*\n/m, '')
  .trim();

// The CoffeeScript object notation is valid JavaScript
const data = eval(`(${arrayContent})`);

if (!Array.isArray(data)) {
  throw new Error('Extracted data is not an array');
}

// Write to JSON file
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

console.log(`✓ Extracted ${data.length} questions`);
EXTRACT_SCRIPT

# Run extraction
if node "$OUTPUT_DIR/extract-wsc.js"; then
  echo -e "${GREEN}✓${NC} Converted to JSON: $JSON_FILE"
  # Clean up temporary files
  rm "$OUTPUT_DIR/extract-wsc.js" "$TEMP_FILE"
else
  echo -e "${RED}✗${NC} Failed to extract JSON"
  rm "$OUTPUT_DIR/extract-wsc.js" "$TEMP_FILE"
  exit 1
fi

# Summary
echo ""
echo -e "${GREEN}Download complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Ensure Bible data is imported:"
echo -e "     ${YELLOW}nx run importer:import:web${NC}"
echo ""
echo "  2. Import the Westminster Shorter Catechism:"
echo -e "     ${YELLOW}nx run importer:import:wsc -- --file $JSON_FILE${NC}"
echo ""
echo "  Or use --force to re-import:"
echo -e "     ${YELLOW}nx run importer:import:wsc -- --file $JSON_FILE --force${NC}"
echo ""
