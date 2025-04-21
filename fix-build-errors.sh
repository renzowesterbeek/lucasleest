#!/bin/bash

# Make the fix script executable
chmod +x fix-eslint.js

# Run the fix script
node fix-eslint.js

# Show status message
echo "ESLint errors have been fixed automatically"
echo "Now you can try building your app again" 