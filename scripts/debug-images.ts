import axios from 'axios';

async function main() {
    try {
        console.log("Fetching articles from http://localhost:2000/api/articles...");
        const response = await axios.get('http://localhost:2000/api/articles');
        const articles = response.data;

        console.log(`Found ${articles.length} articles.`);

        articles.forEach((a: any) => {
            console.log(`\n[${a.title}]`);
            console.log(`  ID: ${a.id}`);
            console.log(`  Slug: ${a.slug}`);
            console.log(`  Image Raw: '${a.image}'`);

            // Simulate getImageSrc logic
            let finalSrc = '';
            if (!a.image) finalSrc = 'PLACEHOLDER';
            else if (a.image.startsWith('http') || a.image.startsWith('data:')) finalSrc = a.image;
            else {
                const baseUrl = 'http://localhost:2000'; // Default
                const cleanPath = a.image.startsWith('/') ? a.image : `/${a.image}`;
                finalSrc = `${baseUrl}${cleanPath}`;
            }
            console.log(`  Resolved Src: ${finalSrc}`);
        });

    } catch (e: any) {
        console.error("Error fetching articles:", e.message);
    }
}

main();
