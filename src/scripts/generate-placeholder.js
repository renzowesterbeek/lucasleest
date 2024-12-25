const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create a 1200x800 canvas (16:9 aspect ratio)
const canvas = createCanvas(1200, 800);
const ctx = canvas.getContext('2d');

// Fill background with a dark blue gradient
const gradient = ctx.createLinearGradient(0, 0, 0, 800);
gradient.addColorStop(0, '#1a1f36');
gradient.addColorStop(1, '#2d3657');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 1200, 800);

// Add some "book shelf" lines
ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
ctx.lineWidth = 2;
for (let y = 200; y < 800; y += 150) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(1200, y);
  ctx.stroke();
}

// Add some vertical "book" lines
ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
for (let x = 50; x < 1200; x += 30) {
  const height = Math.random() * 100 + 50;
  const y = Math.floor(Math.random() * 3) * 150 + 200;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - height);
  ctx.stroke();
}

// Add text overlay
ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
ctx.font = 'bold 48px Arial';
ctx.textAlign = 'center';
ctx.fillText('Lucas Leest', 600, 400);

// Create the images directory if it doesn't exist
const imagesDir = path.join(__dirname, '../../public/images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Save the image
const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
fs.writeFileSync(path.join(imagesDir, 'library.jpg'), buffer);

console.log('Placeholder image created at public/images/library.jpg'); 