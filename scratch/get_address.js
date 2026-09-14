import fs from 'fs';

async function getAddress() {
    const res = await fetch('https://www.google.com/search?q=Alora+Radiance&kgmid=/g/11z92x29jt', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    fs.writeFileSync('scratch/google_search.html', html);
    console.log("Fetched HTML length:", html.length);
}

getAddress();
