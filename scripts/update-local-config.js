// Script to fetch config from API and update local projects-config.js
// Usage: node update-local-config.js

const fs = require('fs');
const path = require('path');
const https = require('https');

// CONFIG: Set your API endpoint and output file path
const API_ENDPOINT = 'https://4x3uabdru4.execute-api.us-east-2.amazonaws.com/config';
const OUTPUT_JS_PATH = path.join(__dirname, '../../SirSluginston-Site/projects-config.js');
const OUTPUT_JSON_PATH = path.join(__dirname, '../../SirSluginston-Site/projects-config.json');

// Utility to unwrap DynamoDB JSON to plain JS
function parseDynamoValue(val) {
  if (val == null) return null;
  if (val.S !== undefined) return val.S;
  if (val.N !== undefined) return Number(val.N);
  if (val.BOOL !== undefined) return val.BOOL;
  if (val.M !== undefined) {
    const obj = {};
    for (const k in val.M) {
      obj[k] = parseDynamoValue(val.M[k]);
    }
    return obj;
  }
  if (val.L !== undefined) {
    return val.L.map(parseDynamoValue);
  }
  return val; // fallback
}


async function main() {
  console.log('Fetching config from API...');
  const projects = await new Promise((resolve, reject) => {
    https.get(API_ENDPOINT, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch config: HTTP ${res.statusCode}`));
        res.resume?.();
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          console.log('--- RAW API RESPONSE ---');
          console.log(data);
          const parsed = JSON.parse(data);
          // Accept either plain JSON array or DynamoDB-typed items
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          const normalized = arr.map((it) => (it && (it.M || it.S || it.N || it.BOOL || it.L)) ? parseDynamoValue(it) : it);

          // Flatten all items into a single array of items
          let allItems = [];
          for (const project of normalized) {
            if (Array.isArray(project.pages)) {
              allItems = allItems.concat(project.pages);
            }
          }

          // Group by projectKey
          const flatProjects = {};
          for (const item of allItems) {
            const key = item.ProjectKey || item.projectKey;
            if (!key) continue;
            if (!flatProjects[key]) flatProjects[key] = { projectKey: key, pages: [] };
            if (item.PageKey === 'project-config' || item.pageKey === 'project-config') {
              // Merge project-level fields
              for (const k in item) {
                if (k !== 'ProjectKey' && k !== 'PageKey') {
                  flatProjects[key][k] = item[k];
                }
              }
            } else {
              // Normalize page keys
              const pageOut = { ...item };
              if (pageOut.ProjectKey) {
                pageOut.projectKey = pageOut.ProjectKey;
                delete pageOut.ProjectKey;
              }
              if (pageOut.PageKey) {
                pageOut.pageKey = pageOut.PageKey;
                delete pageOut.PageKey;
              }
              if (pageOut.pages) delete pageOut.pages;
              flatProjects[key].pages.push(pageOut);
            }
          }
          const normalizedProjects = Object.values(flatProjects);

          // Write ES module for browser import
          const jsModule = `// AUTO-GENERATED: Do not edit manually\nexport const projects = ${JSON.stringify(normalizedProjects, null, 2)};\n`;
          fs.writeFileSync(OUTPUT_JS_PATH, jsModule, 'utf8');
          // Write JSON for Node scripts like static generator
          fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(normalizedProjects, null, 2) + '\n', 'utf8');
          console.log('Local config updated:');
          console.log(' -', OUTPUT_JS_PATH);
          console.log(' -', OUTPUT_JSON_PATH);
          resolve(normalizedProjects);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

main().catch(err => {
  console.error('Error updating local config:', err);
  process.exit(1);
});

