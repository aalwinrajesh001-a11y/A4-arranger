document.addEventListener('DOMContentLoaded', () => {
    const uploadInput = document.getElementById('image-upload');
    const sheetsContainer = document.getElementById('sheets-container');
    const printBtn = document.getElementById('print-btn');
    const clearBtn = document.getElementById('clear-btn');
    const orientationInputs = document.querySelectorAll('input[name="orientation"]');
    const layoutSelect = document.getElementById('layout-select');
    const gapSlider = document.getElementById('gap-slider');
    const gapValue = document.getElementById('gap-value');
    const scaleSlider = document.getElementById('scale-slider');
    const scaleValue = document.getElementById('scale-value');
    const fillCheck = document.getElementById('fill-check');

    let images = []; // Store image source strings

    // Handle Image Upload
    uploadInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        let processed = 0;
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    images.push(event.target.result);
                    processed++;
                    if (processed === files.length) {
                        updateLayout();
                    }
                };
                reader.readAsDataURL(file);
            } else {
                processed++;
            }
        });

        uploadInput.value = '';
    });

    // Handle Changes
    orientationInputs.forEach(input => input.addEventListener('change', updateLayout));
    layoutSelect.addEventListener('change', updateLayout);
    fillCheck.addEventListener('change', updateStyles);

    // Live Update for Sliders (Performance optimization: no full re-render needed, just CSS update)
    gapSlider.addEventListener('input', (e) => {
        gapValue.textContent = e.target.value;
        updateStyles();
    });

    scaleSlider.addEventListener('input', (e) => {
        scaleValue.textContent = e.target.value;
        updateStyles();
    });

    // Handle Clear
    clearBtn.addEventListener('click', () => {
        images = [];
        updateLayout();
    });

    function updateStyles() {
        const gap = gapSlider.value;
        const scale = scaleSlider.value;
        const isCover = fillCheck.checked;

        const sheets = document.querySelectorAll('.a4-sheet');
        sheets.forEach(sheet => {
            sheet.style.gap = `${gap}mm`;
            sheet.style.setProperty('--a4-gap', `${gap}mm`); // CSS Var for Calc
            // Padding of sheet is fixed 10mm currently.
        });

        const containers = document.querySelectorAll('.img-container');
        containers.forEach(container => {
            const img = container.querySelector('img');
            if (img) {
                // Scale effect
                img.style.width = `${scale}%`;
                img.style.height = `${scale}%`;
                // Fill Mode
                img.style.objectFit = isCover ? 'cover' : 'contain';
            }
        });
    }

    function updateLayout() {
        sheetsContainer.innerHTML = '';

        if (images.length === 0) {
            sheetsContainer.innerHTML = '<div class="empty-state">No images uploaded</div>';
            return;
        }

        const isLandscape = document.querySelector('input[name="orientation"]:checked').value === 'landscape';
        const layoutMode = layoutSelect.value;

        let itemsPerPage = images.length;
        if (layoutMode !== 'auto') {
            itemsPerPage = parseInt(layoutMode, 10);
        }

        for (let i = 0; i < images.length; i += itemsPerPage) {
            const chunk = images.slice(i, i + itemsPerPage);
            createSheet(chunk, isLandscape);
        }

        updateStyles();
    }

    function createSheet(imgChunk, isLandscape) {
        const sheet = document.createElement('div');
        sheet.className = 'a4-sheet';
        if (isLandscape) sheet.classList.add('landscape');

        const count = imgChunk.length;
        const sheetWidth = isLandscape ? 297 : 210;
        const sheetHeight = isLandscape ? 210 : 297;

        let bestR = 1, bestC = 1;

        const layoutMode = layoutSelect.value;

        if (layoutMode !== 'auto') {
            const val = parseInt(layoutMode);
            const sqrt = Math.sqrt(val);
            bestC = Math.ceil(sqrt);
            bestR = Math.ceil(val / bestC);
            if (isLandscape && bestR > bestC) [bestR, bestC] = [bestC, bestR];
        } else {
            let bestScore = Infinity;
            for (let c = 1; c <= count; c++) {
                const r = Math.ceil(count / c);
                const cellW = sheetWidth / c;
                const cellH = sheetHeight / r;
                const cellRatio = cellW / cellH;
                const targetRatio = 1.0;
                const score = Math.abs(cellRatio - targetRatio);

                if (score < bestScore) {
                    bestScore = score;
                    bestC = c;
                    bestR = r;
                }
            }
            if (count === 2) {
                if (sheetWidth > sheetHeight) { bestC = 2; bestR = 1; }
                else { bestC = 1; bestR = 2; }
            }
        }

        // Flex Basis Calculation
        // To emulate grid but with "auto fill" capability for last row
        // Width = 100% / Cols. Height = 100% / Rows.
        // We need to account for GAP in the percentage if we want perfect math, 
        // but since we are using gap property in flex container, 
        // simply using calc(100% / C - gapAmount) is cleaner.
        // HOWEVER, dynamic gap in JS is tricky for 'calc'. 
        // Easier: Use Flex basis as simple %, and let 'gap' property handle spacing naturally?
        // No, 'gap' consumes space. So 100% / 3 * 3 + gap*2 > 100%. Wrap occurs.
        // We must subtract gap.

        // Since gap is dynamic, we'll set the style logic to:
        // width: calc( (100% - (itemsInRow - 1)*gap) / itemsInRow )
        // height: calc( (100% - (rows - 1)*gap) / rows )

        // Since this needs to update dynamically with sliders, we might need a CSS variable?
        // Let's set --cols and --rows CSS vars on the sheet!
        sheet.style.setProperty('--cols', bestC);
        sheet.style.setProperty('--rows', bestR);

        imgChunk.forEach(src => {
            const div = document.createElement('div');
            div.className = 'img-container';
            const img = document.createElement('img');
            img.src = src;
            div.appendChild(img);
            sheet.appendChild(div);
        });

        sheetsContainer.appendChild(sheet);
    }

    // Handle Print
    printBtn.addEventListener('click', () => {
        window.print();
    });

    // Handle PDF Download
// Handle PDF Download (FIXED – multi-page safe)
const downloadBtn = document.getElementById('download-btn');
downloadBtn.addEventListener('click', () => {
    const container = document.getElementById('sheets-container');
    if (!container || container.children.length === 0) return;

    const isLandscape =
        document.querySelector('input[name="orientation"]:checked').value === 'landscape';

    const opt = {
        margin: 0,
        filename: 'photo-arrangement.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: isLandscape ? 'landscape' : 'portrait'
        }
    };

    html2pdf()
        .set(opt)
        .from(container)
        .save();
});
});

