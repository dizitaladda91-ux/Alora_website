import tailwind from 'tailwindcss';
import postcss from 'postcss';
import fs from 'fs';
import path from 'path';

async function buildCss() {
    try {
        console.log('Building Tailwind CSS bundle...');
        const inputPath = path.resolve('frontend/styles/tailwind.css');
        const outputPath = path.resolve('frontend/styles/tailwind.min.css');
        const css = fs.readFileSync(inputPath, 'utf8');

        const result = await postcss([
            tailwind('./tailwind.config.js')
        ]).process(css, { from: inputPath, to: outputPath });

        fs.writeFileSync(outputPath, result.css);
        console.log(`Successfully compiled Tailwind CSS to ${outputPath} (${(result.css.length / 1024).toFixed(2)} KB)`);
    } catch (err) {
        console.error('CSS Build Error:', err);
        process.exit(1);
    }
}

buildCss();
