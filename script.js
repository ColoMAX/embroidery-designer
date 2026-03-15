document.addEventListener('DOMContentLoaded', function () {
  const imageInput = document.getElementById('imageInput');
  const controls = document.getElementById('controls');
  const preview = document.getElementById('preview');
  const previewCanvas = document.getElementById('previewCanvas');
  const processBtn = document.getElementById('processBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const printBtn = document.getElementById('printBtn');
  const widthInput = document.getElementById('width');
  const heightInput = document.getElementById('height');
  const maintainAspect = document.getElementById('maintainAspect');
  const paletteSelect = document.getElementById('paletteSelect');
  const numColorsInput = document.getElementById('numColors');
  const paletteMode = document.getElementById('paletteMode');
  const numColorsMode = document.getElementById('numColorsMode');
  const showIndicators = document.getElementById('showIndicators');

  let originalImage = null;
  let originalAspectRatio = 1;
  let outputCanvas = null; // For download

  // Event listeners for maintaining aspect ratio
  widthInput.addEventListener('input', function () {
    if (maintainAspect.checked && originalImage) {
      heightInput.value = Math.round(parseInt(widthInput.value) / originalAspectRatio);
    }
  });

  heightInput.addEventListener('input', function () {
    if (maintainAspect.checked && originalImage) {
      widthInput.value = Math.round(parseInt(heightInput.value) * originalAspectRatio);
    }
  });

  // Predefined palettes
  const palettes = {
    embroidery: [
      [255, 255, 255], // white
      [0, 0, 0], // black
      [255, 0, 0], // red
      [0, 255, 0], // green
      [0, 0, 255], // blue
      [255, 255, 0], // yellow
      [255, 0, 255], // magenta
      [0, 255, 255], // cyan
      [128, 128, 128], // gray
      [139, 69, 19], // brown
      [255, 165, 0], // orange
      [128, 0, 128], // purple
      [0, 128, 0], // dark green
      [0, 0, 128], // navy
      [255, 192, 203], // pink
      [255, 215, 0] // gold
    ],
    basic: [
      [255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255],
      [255, 255, 0], [255, 0, 255], [0, 255, 255]
    ],
    grayscale: Array.from({ length: 16 }, (_, i) => {
      const val = Math.floor(i * 255 / 15);
      return [val, val, val];
    })
  };

  imageInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
          originalImage = img;
          originalAspectRatio = img.width / img.height;

          // Calculate size to fit within 250x250 while maintaining aspect ratio
          const maxSize = 250;
          let newWidth = img.width;
          let newHeight = img.height;

          if (newWidth > maxSize || newHeight > maxSize) {
            if (newWidth > newHeight) {
              newWidth = maxSize;
              newHeight = Math.round(maxSize / originalAspectRatio);
            } else {
              newHeight = maxSize;
              newWidth = Math.round(maxSize * originalAspectRatio);
            }
          }

          widthInput.value = newWidth;
          heightInput.value = newHeight;

          controls.style.display = 'block';
          preview.style.display = 'none';
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  processBtn.addEventListener('click', function () {
    if (!originalImage) return;

    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);

    // Resize image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(originalImage, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    let palette;
    if (paletteMode.checked) {
      palette = palettes[paletteSelect.value];
    } else {
      // Use quantization to get numColors
      const q = new RgbQuant({
        colors: parseInt(numColorsInput.value),
        method: 2, // neuquant
        initColors: 4096,
        minHueCols: 0,
        dithKern: null,
        dithSerp: false
      });
      q.sample(imageData);
      palette = q.palette(true, true);
    }

    // Apply palette to image
    const quantized = new RgbQuant({
      colors: palette.length,
      palette: palette,
      method: 2,
      initColors: 4096,
      minHueCols: 0,
      dithKern: null,
      dithSerp: false
    });
    quantized.sample(imageData);
    const out = quantized.reduce(imageData);

    // Put back to canvas
    outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outputCtx = outputCanvas.getContext('2d');
    outputCtx.imageSmoothingEnabled = false; // Disable interpolation
    const outputImageData = new ImageData(new Uint8ClampedArray(out), width, height);
    outputCtx.putImageData(outputImageData, 0, 0);

    // Display preview with grid
    const scale = 10; // pixels per stitch
    previewCanvas.width = width * scale;
    previewCanvas.height = height * scale;
    const previewCtx = previewCanvas.getContext('2d');

    // Draw scaled image
    previewCtx.imageSmoothingEnabled = false; // Keep pixelated
    previewCtx.drawImage(outputCanvas, 0, 0, width * scale, height * scale);

    // Draw black grid
    previewCtx.strokeStyle = 'black';
    previewCtx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      previewCtx.beginPath();
      previewCtx.moveTo(x * scale, 0);
      previewCtx.lineTo(x * scale, height * scale);
      previewCtx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      previewCtx.beginPath();
      previewCtx.moveTo(0, y * scale);
      previewCtx.lineTo(width * scale, y * scale);
      previewCtx.stroke();
    }

    // Draw white crosses at intersections
    previewCtx.strokeStyle = 'white';
    previewCtx.lineWidth = 1;
    const crossSize = 2; // half size of cross arms
    for (let x = 0; x <= width; x++) {
      for (let y = 0; y <= height; y++) {
        const cx = x * scale;
        const cy = y * scale;
    // Horizontal arm
        previewCtx.beginPath();
        previewCtx.moveTo(cx - crossSize, cy);
        previewCtx.lineTo(cx + crossSize, cy);
        previewCtx.stroke();
        // Vertical arm
        previewCtx.beginPath();
        previewCtx.moveTo(cx, cy - crossSize);
        previewCtx.lineTo(cx, cy + crossSize);
        previewCtx.stroke();
      }
    }

    // Draw color indicators if enabled
    if (showIndicators.checked) {
      const symbols = ['1','2','3','4','5','6','7','8','9','0','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','+','x','o','*','■','▲','●','◆','○','△'];

      function findColorIndex(r, g, b) {
        for (let i = 0; i < palette.length; i++) {
          if (palette[i][0] === r && palette[i][1] === g && palette[i][2] === b) return i;
        }
        return 0;
      }

      previewCtx.font = '8px Arial';
      previewCtx.textAlign = 'center';
      previewCtx.textBaseline = 'middle';

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const r = out[index], g = out[index+1], b = out[index+2];
          const colorIndex = findColorIndex(r, g, b);
          const symbol = symbols[colorIndex % symbols.length];
          const intensity = (r + g + b) / 3;
          previewCtx.fillStyle = intensity > 128 ? 'black' : 'white';
          const cx = (x + 0.5) * scale;
          const cy = (y + 0.5) * scale;
          previewCtx.fillText(symbol, cx, cy);
        }
      }
    }

    preview.style.display = 'block';
  });

  downloadBtn.addEventListener('click', function () {
    if (!outputCanvas) return;
    const link = document.createElement('a');
    link.download = 'embroidery-design.png';
    link.href = outputCanvas.toDataURL('image/png');
    link.click();
  });

  printBtn.addEventListener('click', function () {
    window.print();
  });
});