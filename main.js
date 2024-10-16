const puppeteer = require('puppeteer-core');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { TIMEOUT } = require('dns');


// List of base URLs
const baseURLs = [
  'https://www.buyrentkenya.com/property-for-sale?price=0-1000000',
  // Add more URLs as needed
];

const cookies = [
  {
    "name": "cookies_cleared_20230614",
    "value": "eyJpdiI6IjYvaTE4OURiOXJzS3VQOTFUVmR1WXc9PSIsInZhbHVlIjoiN1NpdW5XUVlXeGZvaEgvMDQvbUdrMVRvaFhZMjZkKzc2QkpBd3Joa2hvZGdmS1hRMlR1MzdQQit0UmZvMVQ2bCIsIm1hYyI6IjYzZWRkNWQyMDgwZWU5ZmNjYzBhMjkyMjNhZDNkZTlhMjdkYmYzMTNiY2E4MDEzYTA5Yjk0MDA5ZjdjMzhjOTQiLCJ0YWciOiIifQ%3D%3D",
    "domain": ".www.buyrentkenya.com",
    "path": "/",
  },
  {
    "name": "cf_clearance",
    "value": "ewlz_RHqEGDijgC3PN9Hg0wzBFEMDdcQjf6Rrl1vnBQ-1727964267-1.2.1.1-yY8cR_JHy8FRnzVx6K5uQJmBagP_owMnz7n2ovcfKJIBLpFUOs60p.LIvJJ7ERh8QZEEEaskR0SB0tn8azvM3ZjMcfvua7D.WuwYoq1ATy_ySRvM4HqtqfAB94.DZpBXNMGuGSKWGHfpecvu0xm1_yF_uAt7JeqXGyAAS5A8ucqxIJlJAbG34R8j3KKskbnqs2sVJpdMM5ewIOUWg1whj8zZ4ZcJ5KaLQvsU.pLlBypgL_vcMaZCF2ITJahBWSvSv93qxXW6Dztf_xrH6vqT8zcYDWcLcsH_x6byPvBzN.yKeCUx0nh5ZLKvIBygCVR2V2YhLTQb2KO6wMI8wLK5JD8ikCaZGeOmlwXEBuZhXPICSlpqkeKaquVXx0XLRXdQMvliO02CdN_yStRyH3OT7Xd.K2sWCk50lExNmdrVR9DqDGZcX1p8FUOrbgGlNbGt",
    "domain": ".buyrentkenya.com",
    "path": "/",
  },
  {
   "name": "g_state",
    "value": "{\"i_p\":1725789035722,\"i_l\":2}",
    "domain": ".www.buyrentkenya.com",
    "path": "/",
  },
  {
    "name": "XSRF-TOKEN",
    "value": "eyJpdiI6ImtzcnBmR0J5a1FrUytNN0VuS2I2ekE9PSIsInZhbHVlIjoic2d5dUNvZGN0MkNvc3JSNlVKSXJTK1g1ZnVGTDlJNE5IcWdrbmp0REhhOXdvNnVCTDNjbTdSa1ZoZFlBelRFZ01Hd0FETXpySGZWSzUrVmIrdmpiRVBEZ2dwUGNTOVpOSGNPVVFCd0ZWUWNNQUVLZHVzandGM3JuTlJsdUhnWDgiLCJtYWMiOiI5MTlhNzBiY2I1YjNkOGZiNTAwZTMzMWMzZDg4ZDlkOGU0OWU2YjA2ZDVhMjM0NWIyZTRlYjMwMzZjMzY5YzE0IiwidGFnIjoiIn0%3D",
    "domain": ".www.buyrentkenya.com",
    "path": "/",
  }
];

(async () => {
  const browser = await puppeteer.launch({
        headless: 'new', 
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
        ],
        defaultViewport: null,
    });
  const page = await browser.newPage();

  // Set cookies
  await page.setCookie(...cookies);

  for (const baseURL of baseURLs) {
    // Go to the base URL to determine the total number of pages and scrape data for page 1
    await page.goto(baseURL, { waitUntil: 'networkidle2', timeout: 0 });

    // Extract the total number of listings
    const total_listings = await page.evaluate(() => {
      const listingsDiv = document.querySelector('div[data-cy="search-result-count"]');
      if (listingsDiv) {
        const spans = listingsDiv.querySelectorAll('span');
        // The fourth span contains the total number of listings
        if (spans.length >= 4) {
          return parseInt(spans[3].innerText.trim(), 10);
        }
      }
      return 0;
    });

    console.log('Total listings:', total_listings);

    const listings_per_page = 15;
    const total_pages = Math.ceil(total_listings / listings_per_page);
    console.log('Total pages:', total_pages);

    const all_property_urls = new Set();

    // Scrape property URLs from the first page (base URL)
    const property_urls_page_1 = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const urls = new Set();

      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href.includes('/listings/') && !href.includes('account')) {
          const fullUrl = href.startsWith('https') ? href : `https://www.buyrentkenya.com${href}`;
          urls.add(fullUrl);
        }
      });

      return Array.from(urls);
    });

    property_urls_page_1.forEach(url => all_property_urls.add(url));

    // Loop through each subsequent page (skip page 1)
    for (let i = 2; i <= total_pages; i++) {
      const pageURL = `${baseURL}&page=${i}`;
      console.log(`Navigating to page: ${pageURL}`);
      await page.goto(pageURL, { waitUntil: 'networkidle2', timeout: 0 });

      // Extract property URLs from the current page
      const property_urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const urls = new Set();

        links.forEach(link => {
          const href = link.getAttribute('href');
          if (href.includes('/listings/') && !href.includes('account')) {
            const fullUrl = href.startsWith('https') ? href : `https://www.buyrentkenya.com${href}`;
            urls.add(fullUrl);
          }
        });

        return Array.from(urls);
      });

      property_urls.forEach(url => all_property_urls.add(url));
    }

    console.log('Total number of unique property URLs:', all_property_urls.size);

    const propertyData = [];

    // Visit each property URL and scrape data
    for (const propertyUrl of all_property_urls) {
      await page.goto(propertyUrl, { waitUntil: 'networkidle2', timeout: 0 });

      const data = await page.evaluate(async (propertyUrl) => {
        const getLatLong = async (address) => {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
          try {
            const response = await fetch(url);
            const data = await response.json();
            if (data && data.length > 0) {
              const { lat, lon } = data[0];
              return { lat, lon };
            }
          } catch (error) {
            console.error("Error fetching lat/long data:", error);
          }
          return { lat: null, lon: null };
        };

        const breadcrumbItems = document.querySelectorAll('nav[data-cy="breadcrumbs"] li a');
        let transactionType = 'Transaction type not found';
        let propertyType = 'Property type not found';

        if (breadcrumbItems.length >= 2) {
          transactionType = breadcrumbItems[1].innerText.trim(); // Second breadcrumb item for transaction type
        }
        if (breadcrumbItems.length >= 3) {
          propertyType = breadcrumbItems[2].innerText.trim(); // Third breadcrumb item for property type
        }

        // Find the script tag containing the JSON-LD structured data
        const scriptTag = document.querySelector('script[type="application/ld+json"]');
        if (!scriptTag) return null;

        // Parse the JSON data
        const jsonData = JSON.parse(scriptTag.innerText);

        // Extract the relevant details
        const graph = jsonData['@graph'].find(item => item['@type'] === 'RealEstateListing');
        if (!graph) return null;

        const name = graph.name || 'Name not found';

        const priceElement = document.querySelector('span[aria-label="price"]');
        const price = priceElement ? priceElement.innerText.trim() : 'Price not found';
    
        // Extract the second description div element
        const descriptionElements = document.querySelectorAll('div.text-grey-550.mb-0.md\\:mb-2');
        const description = descriptionElements.length > 1 
                            ? descriptionElements[1].innerText.trim() 
                            : 'Description not found';


        // Extract address
        const addressElement = document.querySelector('p[data-cy="listing-address"]');
        const address = addressElement ? addressElement.innerText.trim() : '';

        // Extract area from characteristics
        const areaElement = document.querySelector('span[aria-label="area"]');
        const area = areaElement ? areaElement.innerText.trim() : '';

        // Extract number of bedrooms
        const bedroomsElement = document.querySelector('span[aria-label="bedrooms"]');
        const bedrooms = bedroomsElement ? bedroomsElement.innerText.trim() : '';

        // Extract number of bathrooms
        const bathroomsElement = document.querySelector('span[aria-label="bathrooms"]');
        const bathrooms = bathroomsElement ? bathroomsElement.innerText.trim() : '';

        const { lat, lon } = await getLatLong(address);

        return {
          url: propertyUrl, // Include the property URL here
          name,
          price,
          description,
          area,
          bedrooms,
          bathrooms,
          latitude: lat,
          longitude: lon,
          propertyType,
          transactionType,
          address,
        };
      }, propertyUrl);

      if (data) {
        propertyData.push(data);
        console.log(data);
      }
    }

    // Convert baseURL to a valid filename
    const fileName = baseURL.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.xlsx';

    // Create a new workbook and sheet
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(propertyData);

    // Append the worksheet to the workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Properties');

    // Write the workbook to a file
    xlsx.writeFile(workbook, path.join(__dirname, fileName));

    console.log(`Data saved to ${fileName}`);

    await page.close();
  }

  await browser.close();
})();
